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
      if (url.endsWith("/rpc/Shelly.GetConfig")) return jsonResponse({});
      return jsonResponse({}, 404);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows the same Shelly to be added again after removal", async () => {
    const registry = new DeviceRegistry();
    const adapter = new ShellyAdapter(registry);

    const first = (await adapter.add("192.168.1.50", "", "", "Test Shelly", undefined, undefined, "none"))[0]!;
    await adapter.remove(first.id);
    const second = (await adapter.add("192.168.1.50", "", "", "Test Shelly", undefined, undefined, "none"))[0]!;

    expect(second.id).toBe(first.id);
    expect(registry.get(first.id)).toEqual(second);
    expect(dbMocks.upsertDevice).toHaveBeenCalledTimes(2);
    expect(dbMocks.deleteDevice).toHaveBeenCalledWith(first.id);
  });

  it("preserves a configured presentation type during status refreshes", async () => {
    const registry = new DeviceRegistry();
    const adapter = new ShellyAdapter(registry);

    const added = (await adapter.add("192.168.1.50", "", "", "Extractor", undefined, undefined, "none"))[0]!;
    await registry.patch(added.id, { presentationType: "fan" });
    const refreshed = await adapter.refresh(registry.get(added.id)!);

    expect(refreshed.presentationType).toBe("fan");
  });

  it("reports unreachable devices with a stable error code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const adapter = new ShellyAdapter(new DeviceRegistry());

    await expect(adapter.probe("192.168.1.99")).rejects.toThrow("DEVICE_UNREACHABLE");
  });
});

describe("ShellyAdapter Gen2+ probing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the public /shelly identity endpoint and a GET status request for Plus 2PM", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url.endsWith("/shelly")) {
        return jsonResponse({ id: "shellyplus2pm-test", app: "Plus2PM", model: "SNSW-102P16EU", gen: 2, profile: "switch", ver: "1.7.1" });
      }
      if (url.endsWith("/rpc/Shelly.GetStatus")) {
        return jsonResponse({
          "switch:0": { id: 0, output: true, apower: 18.2 },
          "switch:1": { id: 1, output: false, apower: 0 }
        });
      }
      if (url.endsWith("/rpc/Shelly.GetConfig")) {
        return jsonResponse({
          sys: { device: { name: "Kitchen 2PM" } },
          "switch:0": { id: 0, name: "Ceiling" },
          "switch:1": { id: 1, name: "Cabinet" }
        });
      }
      return jsonResponse({}, 404);
    }));

    const result = await new ShellyAdapter(new DeviceRegistry()).probe("192.168.1.60");

    expect(result.model).toBe("Plus2PM");
    expect(result.device.channelCount).toBe(2);
    expect(result.device.state).toMatchObject({ on: true, power: 18.2 });
    const all = await new ShellyAdapter(new DeviceRegistry()).probeAll("192.168.1.60");
    expect(all.map(item => item.device.name)).toEqual(["Ceiling", "Cabinet"]);
    expect(all.map(item => item.device.componentId)).toEqual([0, 1]);
    expect(calls).toContainEqual({ url: "http://192.168.1.60/rpc/Shelly.GetStatus", method: "GET" });
    expect(calls.some(call => call.url.endsWith("/settings"))).toBe(false);
  });

  it("retries protected Gen2+ RPC calls with SHA-256 digest authentication", async () => {
    const authorizations: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const authorization = headers.get("authorization") ?? "";
      if (url.endsWith("/shelly")) {
        return jsonResponse({ id: "shellyplus2pm-secure", app: "Plus2PM", model: "SNSW-102P16EU", gen: 2, profile: "switch", auth_en: true });
      }
      if (url.endsWith("/rpc/Shelly.GetStatus")) {
        authorizations.push(authorization);
        if (!authorization.startsWith("Digest ")) {
          return new Response("", {
            status: 401,
            headers: { "www-authenticate": 'Digest opaque="gateway\\\"value", algorithm=SHA-256, nonce="testnonce", qop="auth", realm="shellyplus2pm-secure"' }
          });
        }
        return jsonResponse({ "switch:0": { id: 0, output: true }, "switch:1": { id: 1, output: false } });
      }
      return jsonResponse({}, 404);
    }));

    const result = await new ShellyAdapter(new DeviceRegistry()).probe("192.168.1.61", "admin", "secret");

    expect(result.device.channelCount).toBe(2);
    expect(authorizations[0]).toMatch(/^Basic /);
    expect(authorizations[1]).toContain('algorithm=SHA-256');
    expect(authorizations[1]).toContain('uri="/rpc/Shelly.GetStatus"');
    expect(authorizations[1]).toContain("qop=auth");
  });

  it("falls back to a JSON-RPC frame when the method endpoint rejects GET", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/shelly")) {
        return jsonResponse({ id: "shellyplus2pm-frame", app: "Plus2PM", model: "SNSW-102P16EU", gen: 2, profile: "switch" });
      }
      if (url.endsWith("/rpc/Shelly.GetStatus") && (init?.method ?? "GET") === "GET") {
        return jsonResponse({}, 405);
      }
      if (url.endsWith("/rpc") && init?.method === "POST") {
        return jsonResponse({ id: 1, src: "shellyplus2pm-frame", result: { "switch:0": { id: 0, output: false }, "switch:1": { id: 1, output: true } } });
      }
      return jsonResponse({}, 404);
    }));

    const result = await new ShellyAdapter(new DeviceRegistry()).probe("192.168.1.62");
    expect(result.device.channelCount).toBe(2);
    expect(result.device.state.on).toBe(false);
  });
});


describe("ShellyAdapter multi-profile onboarding", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("registers two logical devices for a 2PM in switch profile", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/shelly")) return jsonResponse({ id: "plus2pm-multi", app: "Plus2PM", gen: 2, profile: "switch" });
      if (url.endsWith("/rpc/Shelly.GetStatus")) return jsonResponse({
        "switch:0": { id: 0, output: true, apower: 20 },
        "switch:1": { id: 1, output: false, apower: 0 }
      });
      if (url.endsWith("/rpc/Shelly.GetConfig")) return jsonResponse({
        "switch:0": { id: 0, name: "Main light" },
        "switch:1": { id: 1, name: "Wall light" }
      });
      return jsonResponse({}, 404);
    }));

    const registry = new DeviceRegistry();
    const devices = await new ShellyAdapter(registry).add("192.168.1.70", "", "", undefined, undefined, undefined, "none");

    expect(devices).toHaveLength(2);
    expect(registry.all()).toHaveLength(2);
    expect(devices.map(device => device.name)).toEqual(["Main light", "Wall light"]);
    expect(devices.map(device => device.componentId)).toEqual([0, 1]);
    expect(devices[0]!.id).not.toBe(devices[1]!.id);
  });

  it("sends commands to the selected second switch channel", async () => {
    const commandBodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/shelly")) return jsonResponse({ id: "plus2pm-command", app: "Plus2PM", gen: 2, profile: "switch" });
      if (url.endsWith("/rpc/Shelly.GetStatus")) return jsonResponse({
        "switch:0": { id: 0, output: false },
        "switch:1": { id: 1, output: false }
      });
      if (url.endsWith("/rpc/Shelly.GetConfig")) return jsonResponse({});
      if (url.endsWith("/rpc/Switch.Set") && init?.method === "POST") {
        commandBodies.push(JSON.parse(String(init.body)));
        return jsonResponse({ was_on: false });
      }
      return jsonResponse({}, 404);
    }));

    const registry = new DeviceRegistry();
    const adapter = new ShellyAdapter(registry);
    const devices = await adapter.add("192.168.1.72", "", "", undefined, undefined, undefined, "none");
    await adapter.command({ deviceId: devices[1]!.id, capability: "turnOn", source: "api" });

    expect(commandBodies).toContainEqual({ id: 1, on: true });
  });

  it("registers one window covering for a 2PM in cover profile", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/shelly")) return jsonResponse({ id: "plus2pm-cover", app: "Plus2PM", gen: 2, profile: "cover" });
      if (url.endsWith("/rpc/Shelly.GetStatus")) return jsonResponse({ "cover:0": { id: 0, state: "stopped", current_pos: 55 } });
      if (url.endsWith("/rpc/Shelly.GetConfig")) return jsonResponse({ "cover:0": { id: 0, name: "Shutter" } });
      return jsonResponse({}, 404);
    }));

    const registry = new DeviceRegistry();
    const devices = await new ShellyAdapter(registry).add("192.168.1.71", "", "", undefined, undefined, undefined, "none");

    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ type: "windowCovering", profile: "cover", name: "Shutter", componentId: 0 });
  });
});

describe("ShellyAdapter cover position commands", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends a calibrated Gen2+ cover to the selected percentage", async () => {
    const commandBodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/shelly")) return jsonResponse({ id: "plus2pm-slider", app: "Plus2PM", gen: 2, profile: "cover" });
      if (url.endsWith("/rpc/Shelly.GetStatus")) return jsonResponse({ "cover:0": { id: 0, state: "stopped", current_pos: 40 } });
      if (url.endsWith("/rpc/Shelly.GetConfig")) return jsonResponse({ "cover:0": { id: 0, name: "Living room shutter" } });
      if (url.endsWith("/rpc/Cover.GoToPosition") && init?.method === "POST") {
        commandBodies.push(JSON.parse(String(init.body)));
        return jsonResponse(null);
      }
      return jsonResponse({}, 404);
    }));

    const registry = new DeviceRegistry();
    const adapter = new ShellyAdapter(registry);
    const device = (await adapter.add("192.168.1.80", "", "", undefined, undefined, undefined, "none"))[0]!;

    await adapter.command({ deviceId: device.id, capability: "setTargetPosition", value: 73, source: "api" });

    expect(commandBodies).toContainEqual({ id: 0, pos: 73 });
  });

  it("rejects invalid cover positions before sending a command", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/shelly")) return jsonResponse({ id: "plus2pm-invalid-position", app: "Plus2PM", gen: 2, profile: "cover" });
      if (url.endsWith("/rpc/Shelly.GetStatus")) return jsonResponse({ "cover:0": { id: 0, state: "stopped", current_pos: 40 } });
      if (url.endsWith("/rpc/Shelly.GetConfig")) return jsonResponse({});
      return jsonResponse({}, 404);
    }));

    const registry = new DeviceRegistry();
    const adapter = new ShellyAdapter(registry);
    const device = (await adapter.add("192.168.1.81", "", "", undefined, undefined, undefined, "none"))[0]!;

    await expect(adapter.command({ deviceId: device.id, capability: "setTargetPosition", value: 120, source: "api" })).rejects.toThrow("INVALID_POSITION");
  });
});
