import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db.js", () => ({
  getFritzBoxPresenceConnection: vi.fn(),
  listPresenceTargets: vi.fn(async () => []),
  writeSystemLog: vi.fn(async () => undefined)
}));

import { fritzBoxHostByMac, fritzBoxHostCount, normalizeFritzBoxBaseUrl, normalizePresenceMac } from "./fritzbox-presence.js";

const soap = (body: string) => `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>${body}</s:Body></s:Envelope>`;

afterEach(() => { vi.unstubAllGlobals(); });

describe("FRITZ!Box presence transport", () => {
  it("normalizes local TR-064 addresses and common MAC formats", () => {
    expect(normalizeFritzBoxBaseUrl("fritz.box")).toBe("http://fritz.box:49000");
    expect(normalizeFritzBoxBaseUrl("https://fritz.box")).toBe("https://fritz.box:49443");
    expect(normalizePresenceMac("aa-bb-cc-dd-ee-ff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normalizePresenceMac("AABB.CCDD.EEFF")).toBe("AA:BB:CC:DD:EE:FF");
    expect(normalizePresenceMac("aabbccddeeff")).toBe("AA:BB:CC:DD:EE:FF");
    expect(() => normalizePresenceMac("not-a-mac")).toThrow("PRESENCE_MAC_INVALID");
  });

  it("reads the FRITZ!Box host count from the Hosts service", async () => {
    const fetchMock = vi.fn(async () => new Response(soap("<u:GetHostNumberOfEntriesResponse><NewHostNumberOfEntries>17</NewHostNumberOfEntries></u:GetHostNumberOfEntriesResponse>"), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fritzBoxHostCount("http://fritz.box:49000")).resolves.toBe(17);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://fritz.box:49000/upnp/control/hosts");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ soapaction: '"urn:dslforum-org:service:Hosts:1#GetHostNumberOfEntries"' });
  });

  it("queries a known MAC with GetSpecificHostEntry", async () => {
    const fetchMock = vi.fn(async () => new Response(soap("<u:GetSpecificHostEntryResponse><NewIPAddress>192.168.178.42</NewIPAddress><NewInterfaceType>802.11</NewInterfaceType><NewActive>1</NewActive><NewHostName>phone</NewHostName></u:GetSpecificHostEntryResponse>"), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fritzBoxHostByMac("http://fritz.box:49000", "", "", "AA:BB:CC:DD:EE:FF")).resolves.toEqual({active:true,ipAddress:"192.168.178.42",interfaceType:"802.11",hostName:"phone"});
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("<NewMACAddress>AA:BB:CC:DD:EE:FF</NewMACAddress>");
  });

  it("retries a protected Hosts request with HTTP Digest authentication", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 401, headers: { "www-authenticate": 'Digest realm="fritz", nonce="abc123", algorithm=MD5, qop="auth"' } }))
      .mockResolvedValueOnce(new Response(soap("<u:GetHostNumberOfEntriesResponse><NewHostNumberOfEntries>3</NewHostNumberOfEntries></u:GetHostNumberOfEntriesResponse>"), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fritzBoxHostCount("http://fritz.box:49000", "salta", "secret")).resolves.toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(secondHeaders.authorization).toMatch(/^Digest /);
    expect(secondHeaders.authorization).toContain('username="salta"');
  });
});
