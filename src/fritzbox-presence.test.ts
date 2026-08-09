import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db.js", () => ({
  getFritzBoxPresenceConnection: vi.fn(),
  listPresenceTargets: vi.fn(async () => []),
  writeSystemLog: vi.fn(async () => undefined)
}));

import { FritzBoxPresenceAdapter, fritzBoxHostByMac, fritzBoxHostCount, normalizeFritzBoxBaseUrl, normalizePresenceMac } from "./fritzbox-presence.js";
import type { DeviceRegistry } from "./registry.js";

const soap = (body: string) => `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>${body}</s:Body></s:Envelope>`;
const servers: Array<ReturnType<typeof createServer>> = [];

async function localServer(handler: (request: IncomingMessage, response: ServerResponse) => void): Promise<string> {
  const server = createServer(handler);
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

  it("keeps TLS certificate bypass request-scoped", () => {
    const source = readFileSync(new URL("./fritzbox-presence.ts", import.meta.url), "utf8");
    expect(source).toContain("rejectUnauthorized:!tlsInsecure");
    expect(source).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED");
  });
});
