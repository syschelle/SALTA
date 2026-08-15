import { describe, expect, it } from "vitest";
import { hueHttpsRequestOptions, isHueLocalAddress } from "./hue-tls.js";

describe("Philips Hue local TLS policy", () => {
  it("accepts private and link-local bridge addresses only", () => {
    for (const address of ["192.168.178.25", "10.0.0.10", "172.16.0.2", "169.254.10.20", "127.0.0.1", "fd00::25", "fe80::25", "::1"]) {
      expect(isHueLocalAddress(address), address).toBe(true);
    }
    for (const address of ["8.8.8.8", "1.1.1.1", "203.0.113.10", "2001:4860:4860::8888"]) {
      expect(isHueLocalAddress(address), address).toBe(false);
    }
  });

  it("uses Signify CA verification and the bridge id as TLS server name", async () => {
    const options = await hueHttpsRequestOptions("https://192.168.178.25", { bridgeId: "001788FFFE123456" });
    expect(options.rejectUnauthorized).toBe(true);
    expect(options.servername).toBe("001788FFFE123456");
    expect(String(options.ca)).toContain("BEGIN CERTIFICATE");
    expect(options.checkServerIdentity).toBeUndefined();
  });

  it("allows CA-verified identity discovery without disabling certificate-chain validation", async () => {
    const options = await hueHttpsRequestOptions("https://192.168.178.25", { allowBridgeDiscovery: true });
    expect(options.rejectUnauthorized).toBe(true);
    expect(options.checkServerIdentity).toBeTypeOf("function");
  });

  it("rejects public targets and non-standard HTTPS ports", async () => {
    await expect(hueHttpsRequestOptions("https://8.8.8.8", { bridgeId: "001788FFFE123456" })).rejects.toThrow("HUE_LOCAL_NETWORK_REQUIRED");
    await expect(hueHttpsRequestOptions("https://192.168.178.25:8443", { bridgeId: "001788FFFE123456" })).rejects.toThrow("HUE_URL_INVALID");
  });
});
