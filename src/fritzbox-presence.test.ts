import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db.js", () => ({
  getFritzBoxPresenceConnection: vi.fn(),
  listPresenceTargets: vi.fn(async () => []),
  writeSystemLog: vi.fn(async () => undefined)
}));

import { FritzBoxPresenceAdapter, fritzBoxHostByMac, fritzBoxHostCount, normalizeFritzBoxBaseUrl, normalizePresenceMac } from "./fritzbox-presence.js";
import { writeSystemLog } from "./db.js";
import type { DeviceRegistry } from "./registry.js";

const soap = (body: string) => `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>${body}</s:Body></s:Envelope>`;
const servers: Array<ReturnType<typeof createServer>> = [];

async function localServer(handler: (request: IncomingMessage, response: ServerResponse) => void, controlUrl = "/upnp/control/hosts"): Promise<string> {
  const server = createServer((request,response)=>{
    if(request.method === "GET" && request.url === "/tr64desc.xml") {
      response.writeHead(200,{"content-type":"text/xml"});
      response.end(`<?xml version="1.0"?><root><device><serviceList><service><serviceType>urn:dslforum-org:service:Hosts:1</serviceType><serviceId>urn:LanDeviceHosts-com:serviceId:Hosts1</serviceId><controlURL>${controlUrl}</controlURL><SCPDURL>/hostsSCPD.xml</SCPDURL></service></serviceList></device></root>`);
      return;
    }
    handler(request,response);
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("TEST_SERVER_ADDRESS_MISSING");
  return `http://127.0.0.1:${address.port}`;
}

async function requestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.clearAllMocks();
});

describe("FRITZ!Box presence transport", () => {
  it("normalizes both TR-064 protocols, both common ports and common MAC formats", () => {
    expect(normalizeFritzBoxBaseUrl("fritz.box")).toBe("http://fritz.box:49000");
    expect(normalizeFritzBoxBaseUrl("https://fritz.box")).toBe("https://fritz.box:49443");
    expect(normalizeFritzBoxBaseUrl("http://fritz.box:49443")).toBe("http://fritz.box:49443");
    expect(normalizeFritzBoxBaseUrl("https://fritz.box:49000")).toBe("https://fritz.box:49000");
    expect(normalizePresenceMac("aa-bb-cc-dd-ee-ff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normalizePresenceMac("AABB.CCDD.EEFF")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normalizePresenceMac("aabbccddeeff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(() => normalizePresenceMac("not-a-mac")).toThrow("PRESENCE_MAC_INVALID");
  });

  it("sends SOAP bodies with an explicit UTF-8 Content-Length instead of chunked transfer encoding", async () => {
    let contentLength = "";
    let transferEncoding = "";
    let receivedBody = "";
    const baseUrl = await localServer(async (request, response) => {
      contentLength = String(request.headers["content-length"] ?? "");
      transferEncoding = String(request.headers["transfer-encoding"] ?? "");
      receivedBody = await requestBody(request);
      response.writeHead(200, { "content-type": "text/xml" });
      response.end(soap("<u:GetHostNumberOfEntriesResponse><NewHostNumberOfEntries>4</NewHostNumberOfEntries></u:GetHostNumberOfEntriesResponse>"));
    });

    await expect(fritzBoxHostCount(baseUrl)).resolves.toBe(4);
    expect(contentLength).toBe(String(Buffer.byteLength(receivedBody, "utf8")));
    expect(Number(contentLength)).toBeGreaterThan(0);
    expect(transferEncoding).toBe("");
  });

  it("reads the FRITZ!Box host count from the Hosts service", async () => {
    let soapAction = "";
    const baseUrl = await localServer((request, response) => {
      soapAction = String(request.headers.soapaction ?? "");
      response.writeHead(200, { "content-type": "text/xml" });
      response.end(soap("<u:GetHostNumberOfEntriesResponse><NewHostNumberOfEntries>17</NewHostNumberOfEntries></u:GetHostNumberOfEntriesResponse>"));
    });
    await expect(fritzBoxHostCount(baseUrl)).resolves.toBe(17);
    expect(soapAction).toBe('"urn:dslforum-org:service:Hosts:1#GetHostNumberOfEntries"');
  });


  it("keeps the result of a manual connection test visible independently of presence polling", async () => {
    const baseUrl = await localServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/xml" });
      response.end(soap("<u:GetHostNumberOfEntriesResponse><NewHostNumberOfEntries>9</NewHostNumberOfEntries></u:GetHostNumberOfEntriesResponse>"));
    });
    const adapter = new FritzBoxPresenceAdapter({} as DeviceRegistry);
    await expect(adapter.testConnection({baseUrl,username:"",password:"",tlsInsecure:false})).resolves.toEqual({hostCount:9});
    expect(adapter.getStatus()).toMatchObject({lastTestSuccess:true,lastTestHostCount:9,lastTestBaseUrl:baseUrl});
    expect(adapter.getStatus().lastTestAt).toBeTruthy();
  });

  it("keeps a failed manual connection test visible for the Presence page", async () => {
    const baseUrl = await localServer((_request, response) => {
      response.writeHead(503, { "content-type": "text/xml" });
      response.end(soap("<u:Fault></u:Fault>"));
    });
    const adapter = new FritzBoxPresenceAdapter({} as DeviceRegistry);
    await expect(adapter.testConnection({baseUrl,username:"",password:"",tlsInsecure:false})).rejects.toThrow("FRITZBOX_HTTP_503");
    expect(adapter.getStatus()).toMatchObject({lastTestSuccess:false,lastTestError:"FRITZBOX_HTTP_503",lastTestBaseUrl:baseUrl});
    expect(adapter.getStatus().lastTestAt).toBeTruthy();
  });

  it("writes failed manual presence connection tests to the persistent system log without credentials", async () => {
    const baseUrl = await localServer((_request, response) => {
      response.writeHead(503, { "content-type": "text/xml" });
      response.end(soap("<u:Fault></u:Fault>"));
    });
    const adapter = new FritzBoxPresenceAdapter({} as DeviceRegistry);
    await expect(adapter.testConnection({baseUrl,username:"salta",password:"super-secret",tlsInsecure:false})).rejects.toThrow();
    expect(vi.mocked(writeSystemLog)).toHaveBeenCalledWith(
      "error",
      "presence",
      expect.any(String),
      "FRITZ!Box presence connection test failed",
      expect.objectContaining({baseUrl,usernameConfigured:true,tlsCertificateVerificationDisabled:false})
    );
    const details = vi.mocked(writeSystemLog).mock.calls.at(-1)?.[4] ?? {};
    expect(JSON.stringify(details)).not.toContain("super-secret");
  });

  it("queries a known MAC with GetSpecificHostEntry", async () => {
    let body = "";
    const baseUrl = await localServer(async (request, response) => {
      body = await requestBody(request);
      response.writeHead(200, { "content-type": "text/xml" });
      response.end(soap("<u:GetSpecificHostEntryResponse><NewIPAddress>192.168.178.42</NewIPAddress><NewInterfaceType>802.11</NewInterfaceType><NewActive>1</NewActive><NewHostName>phone</NewHostName></u:GetSpecificHostEntryResponse>"));
    });
    await expect(fritzBoxHostByMac(baseUrl, "", "", "AA:BB:CC:DD:EE:FF")).resolves.toEqual({active:true,ipAddress:"192.168.178.42",interfaceType:"802.11",hostName:"phone"});
    expect(body).toContain("<NewMACAddress>AA:BB:CC:DD:EE:FF</NewMACAddress>");
  });


  it("tries the rights-free Hosts action without authentication even when credentials are configured", async () => {
    let body = "";
    let authorization = "";
    const baseUrl = await localServer(async (request,response)=>{
      body=await requestBody(request);
      authorization=String(request.headers.authorization??"");
      response.writeHead(200,{"content-type":"text/xml"});
      response.end(soap("<u:GetHostNumberOfEntriesResponse><NewHostNumberOfEntries>11</NewHostNumberOfEntries></u:GetHostNumberOfEntriesResponse>"));
    });
    await expect(fritzBoxHostCount(baseUrl,"salta","even-wrong-is-irrelevant")).resolves.toBe(11);
    expect(body).not.toContain("InitChallenge");
    expect(body).not.toContain("ClientAuth");
    expect(authorization).toBe("");
  });

  it("supports AVM SOAP content-level authentication when the box actually requests it", async () => {
    let requests = 0;
    let firstBody = "";
    let secondBody = "";
    let thirdBody = "";
    const baseUrl = await localServer(async (request, response) => {
      requests += 1;
      const body = await requestBody(request);
      if (requests === 1) {
        firstBody = body;
        response.writeHead(503, { "content-type": "text/xml" });
        response.end(soap("<s:Fault><errorCode>503</errorCode><errorDescription>Auth. failed</errorDescription></s:Fault>"));
        return;
      }
      if (requests === 2) {
        secondBody = body;
        response.writeHead(500, { "content-type": "text/xml" });
        response.end(`<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Header><h:Challenge xmlns:h="http://soap-authentication.org/digest/2001/10/"><Status>Unauthenticated</Status><Nonce>F758BE72FB999CEA</Nonce><Realm>F!Box SOAP-Auth</Realm></h:Challenge></s:Header><s:Body><s:Fault><errorCode>503</errorCode><errorDescription>Auth. failed</errorDescription></s:Fault></s:Body></s:Envelope>`);
        return;
      }
      thirdBody = body;
      response.writeHead(200, { "content-type": "text/xml" });
      response.end(`<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Header><h:NextChallenge xmlns:h="http://soap-authentication.org/digest/2001/10/"><Status>Authenticated</Status><Nonce>0B9813494DD27C93</Nonce><Realm>F!Box SOAP-Auth</Realm></h:NextChallenge></s:Header><s:Body><u:GetHostNumberOfEntriesResponse xmlns:u="urn:dslforum-org:service:Hosts:1"><NewHostNumberOfEntries>42</NewHostNumberOfEntries></u:GetHostNumberOfEntriesResponse></s:Body></s:Envelope>`);
    });

    await expect(fritzBoxHostCount(baseUrl, "admin", "gurkensalat")).resolves.toBe(42);
    expect(requests).toBe(3);
    expect(firstBody).not.toContain("InitChallenge");
    expect(secondBody).toContain("<h:InitChallenge");
    expect(secondBody).toContain("<UserID>admin</UserID>");
    expect(thirdBody).toContain("<h:ClientAuth");
    expect(thirdBody).toContain("<Nonce>F758BE72FB999CEA</Nonce>");
    expect(thirdBody).toContain("<Realm>F!Box SOAP-Auth</Realm>");
    expect(thirdBody).toContain("<Auth>b4f67585f22b0af7c4615db5a18faa14</Auth>");
  });

  it("uses the Hosts controlURL advertised by tr64desc.xml", async () => {
    let requestedPath="";
    const baseUrl=await localServer((request,response)=>{
      requestedPath=String(request.url??"");
      response.writeHead(200,{"content-type":"text/xml"});
      response.end(soap("<u:GetHostNumberOfEntriesResponse><NewHostNumberOfEntries>5</NewHostNumberOfEntries></u:GetHostNumberOfEntriesResponse>"));
    },"/custom/control/hosts1");
    await expect(fritzBoxHostCount(baseUrl)).resolves.toBe(5);
    expect(requestedPath).toBe("/custom/control/hosts1");
  });

  it("maps a failed SOAP content-level login to the authentication error", async () => {
    let requests = 0;
    const baseUrl = await localServer(async (_request, response) => {
      requests += 1;
      if(requests===1) {
        response.writeHead(503,{"content-type":"text/xml"});
        response.end(soap("<s:Fault><errorCode>503</errorCode><errorDescription>Auth. failed</errorDescription></s:Fault>"));
        return;
      }
      response.writeHead(500, { "content-type": "text/xml" });
      response.end(`<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Header><h:Challenge xmlns:h="http://soap-authentication.org/digest/2001/10/"><Status>Unauthenticated</Status><Nonce>${requests === 2 ? "ABC" : "DEF"}</Nonce><Realm>F!Box SOAP-Auth</Realm></h:Challenge></s:Header><s:Body><s:Fault><errorCode>503</errorCode><errorDescription>Auth. failed</errorDescription></s:Fault></s:Body></s:Envelope>`);
    });

    await expect(fritzBoxHostCount(baseUrl, "salta", "wrong")).rejects.toThrow("FRITZBOX_AUTHENTICATION_FAILED");
    expect(requests).toBe(3);
  });

  it("retries a protected Hosts request with HTTP Digest authentication", async () => {
    let requests = 0;
    let authorization = "";
    const baseUrl = await localServer((request, response) => {
      requests += 1;
      authorization = String(request.headers.authorization ?? authorization);
      if (requests === 1) {
        response.writeHead(401, { "www-authenticate": 'Digest realm="fritz", nonce="abc123", algorithm=MD5, qop="auth"' });
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "text/xml" });
      response.end(soap("<u:GetHostNumberOfEntriesResponse><NewHostNumberOfEntries>3</NewHostNumberOfEntries></u:GetHostNumberOfEntriesResponse>"));
    });
    await expect(fritzBoxHostCount(baseUrl, "salta", "secret")).resolves.toBe(3);
    expect(requests).toBe(2);
    expect(authorization).toMatch(/^Digest /);
    expect(authorization).toContain('username="salta"');
  });

  it("carries person display names into the aggregate house presence state", () => {
    const source = readFileSync(new URL("./fritzbox-presence.ts", import.meta.url), "utf8");
    expect(source).toContain("personName:target.personName");
    expect(source).toContain("presentNames:JSON.stringify(presentNames)");
    expect(source).toContain("memberNames:JSON.stringify(memberNames)");
  });

  it("keeps TLS certificate bypass request-scoped", () => {
    const source = readFileSync(new URL("./fritzbox-presence.ts", import.meta.url), "utf8");
    expect(source).toContain("rejectUnauthorized:!tlsInsecure");
    expect(source).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED");
  });
});
