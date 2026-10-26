import { describe, expect, it, vi } from "vitest";
import { FritzBoxSmartHomeAdapter, mapFritzBoxSmartHomeOverview } from "./fritzbox-smarthome.js";
import type { Device, FritzBoxSmartHomeSettings } from "./types.js";

const settings: FritzBoxSmartHomeSettings = { enabled: true, thermostats: true, outlets: false, lights: false, sensors: false };
const overview = {
  devices: [{ UID: "thermo-parent", name: "Bad", productName: "FRITZ!Smart Thermo 302", productCategory: "thermostat", isConnected: true }],
  units: [{ UID: "thermo-unit", deviceUid: "thermo-parent", name: "Bad", isConnected: true, unitType: "thermostat", interfaces: { temperatureInterface: { celsius: 21.5 }, thermostatInterface: { setPointTemperature: { mode: "temperature", celsius: 20 } } } }]
};

describe("FRITZ!Box Smart Home local device configuration", () => {
  it("preserves SALTA room, custom name, favorite and presentation across reconciliation", async () => {
    const imported = mapFritzBoxSmartHomeOverview(overview, settings)[0]!;
    let current: Device = { ...imported, name: "Bad Heizkörper", roomId: "room-bad", room: "Bad", favorite: true, presentationType: "auto" };
    const registry = {
      all: () => [current],
      get: (id: string) => id === current.id ? current : undefined,
      set: vi.fn(async (device: Device) => { current = device; })
    } as never;
    const request = vi.fn(async (url: string, method: string) => {
      if (url.includes("login_sid.lua") && method === "GET") return { status: 200, headers: {}, text: "<SessionInfo><SID>0123456789abcdef</SID><Challenge>unused</Challenge><BlockTime>0</BlockTime></SessionInfo>" };
      if (url.endsWith("/api/v0/smarthome/overview") && method === "GET") return { status: 200, headers: {}, text: JSON.stringify(overview) };
      throw new Error(`unexpected ${method} ${url}`);
    });
    const adapter = new FritzBoxSmartHomeAdapter(registry, {
      loadSettings: async () => settings,
      loadConnection: async () => ({ baseUrl: "http://fritz.box:49000", username: "user", password: "secret", enabled: true, pollIntervalSeconds: 30, absenceDelaySeconds: 300, tlsInsecure: false }),
      request,
      log: vi.fn(async () => undefined)
    });

    await adapter.reconcile();

    expect(current).toMatchObject({
      name: "Bad Heizkörper",
      roomId: "room-bad",
      room: "Bad",
      favorite: true,
      presentationType: "auto",
      reachable: true
    });
  });
});
