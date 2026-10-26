import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { FritzBoxSmartHomeAdapter, fritzBoxSmartHomeSafeErrorBody } from "./fritzbox-smarthome.js";
import type { Device, FritzBoxSmartHomeSettings } from "./types.js";

const enabled: FritzBoxSmartHomeSettings = { enabled: true, thermostats: true, outlets: false, lights: false, sensors: false };
const connection = { baseUrl: "http://fritz.box:49000", username: "user", password: "secret", enabled: false, pollIntervalSeconds: 30, absenceDelaySeconds: 300, tlsInsecure: false };
const registry = { all: () => [] as Device[], set: vi.fn(), get: vi.fn() } as never;

describe("FRITZ!Box Smart Home diagnostics and login throttling", () => {
  it("waits for AVM BlockTime before sending login credentials", async () => {
    vi.useFakeTimers();
    try {
      const calls: string[] = [];
      const request = vi.fn(async (url: string, method: string) => {
        calls.push(method + " " + url);
        if (url.includes("login_sid.lua") && method === "GET") return { status: 200, headers: {}, text: "<SessionInfo><SID>0000000000000000</SID><Challenge>12345678</Challenge><BlockTime>2</BlockTime></SessionInfo>" };
        if (url.includes("login_sid.lua") && method === "POST") return { status: 200, headers: {}, text: "<SessionInfo><SID>0123456789abcdef</SID><Challenge>unused</Challenge><BlockTime>0</BlockTime></SessionInfo>" };
        if (url.endsWith("/api/v0/smarthome/overview")) return { status: 200, headers: {}, text: JSON.stringify({ devices: [], units: [] }) };
        throw new Error("unexpected " + method + " " + url);
      });
      const adapter = new FritzBoxSmartHomeAdapter(registry, { loadSettings: async () => enabled, loadConnection: async () => connection, request, log: vi.fn(async () => undefined) });
      const pending = adapter.reconcile();
      await vi.advanceTimersByTimeAsync(1999);
      expect(calls.filter(call => call.startsWith("POST "))).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(calls.filter(call => call.startsWith("POST "))).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });

  it("logs HTTP status, method, endpoint and a sanitized structured AVM error body", async () => {
    const log = vi.fn(async () => undefined);
    const request = vi.fn(async (url: string, method: string) => {
      if (url.includes("login_sid.lua")) return { status: 200, headers: {}, text: "<SessionInfo><SID>0123456789abcdef</SID><Challenge>unused</Challenge><BlockTime>0</BlockTime></SessionInfo>" };
      return { status: 400, headers: { "content-type": "application/json" }, text: JSON.stringify({ errors: [{ code: "INVALID_ARGUMENT", message: "bad request", username: "must-not-leak", sessionId: "must-not-leak" }] }) };
    });
    const adapter = new FritzBoxSmartHomeAdapter(registry, { loadSettings: async () => enabled, loadConnection: async () => connection, request, log });
    await adapter.reconcile();
    const warning = log.mock.calls.find(call => call[2] === "FRITZBOX_SMARTHOME_SYNC_FAILED");
    expect(warning).toBeTruthy();
    const details = warning?.[4] as Record<string, unknown>;
    expect(details).toMatchObject({ error: "FRITZBOX_SMARTHOME_HTTP_400", status: 400, method: "GET", endpoint: "/smarthome/overview" });
    expect(JSON.stringify(details.responseBody)).toContain("INVALID_ARGUMENT");
    expect(JSON.stringify(details.responseBody)).not.toContain("must-not-leak");
  });

  it("never exposes secret fields from structured FRITZ!Box error responses", () => {
    const safe = fritzBoxSmartHomeSafeErrorBody(JSON.stringify({ message: "invalid", password: "pw", authorization: "sid", nested: { token: "token", code: 12 } }));
    expect(safe).toEqual({ message: "invalid", nested: { code: 12 } });
  });

  it("wires Smart Home settings and runtime status into the sanitized diagnostic export", () => {
    const source = readFileSync(new URL("./diagnostic-export.ts", import.meta.url), "utf8");
    const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
    expect(source).toContain("getFritzBoxSmartHomeSettings");
    expect(source).toContain("fritzBoxSmartHome: fritzBoxSmartHomeSettings");
    expect(source).toContain("fritzBoxSmartHome: deps.fritzSmartHome.status()");
    expect(main).toContain("presence, fritzSmartHome, climate");
  });
});
