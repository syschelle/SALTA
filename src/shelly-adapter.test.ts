import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  deleteDevice: vi.fn(async (): Promise<boolean> => true),
  getDeviceCredentials: vi.fn(async () => ({ username: "", password: "" })),
  setDeviceCredentials: vi.fn(async (): Promise<void> => undefined),
  upsertDevice: vi.fn(async (): Promise<void> => undefined)
}));

vi.mock("./db.js", () => dbMocks);

import { DeviceRegistry } from "./registry.js";
import { ShellyAdapter } from "./shelly-adapter.js";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("ShellyAdapter device lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/rpc/Shelly.GetDeviceInfo")) {
        return jsonResponse({ id: "shellyplus1-test", app: "Plus1", model: "SNSW-001X16EU", gen: 2, ver: "1.7.1" });
      }
      if (url.endsWith("/rpc/Shelly.GetStatus")) {
        return jsonResponse({ "switch:0": { output: false, apower: 0 } });
      }
      return jsonResponse({}, 404);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows the same Shelly to be added again after removal", async () => {
    const registry = new DeviceRegistry();
    const adapter = new ShellyAdapter(registry);

    const first = await adapter.add("192.168.1.50", "", "", "Test Shelly", undefined, undefined, "none");
    await adapter.remove(first.id);
    const second = await adapter.add("192.168.1.50", "", "", "Test Shelly", undefined, undefined, "none");

    expect(second.id).toBe(first.id);
    expect(registry.get(first.id)).toEqual(second);
    expect(dbMocks.upsertDevice).toHaveBeenCalledTimes(2);
    expect(dbMocks.deleteDevice).toHaveBeenCalledWith(first.id);
  });

  it("reports unreachable devices with a stable error code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const adapter = new ShellyAdapter(new DeviceRegistry());

    await expect(adapter.probe("192.168.1.99")).rejects.toThrow("DEVICE_UNREACHABLE");
  });
});
