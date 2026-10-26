import { describe, expect, it, vi } from "vitest";
import { pbkdf2Sync } from "node:crypto";
import { FritzBoxSmartHomeAdapter, fritzBoxSidResponse, fritzBoxWebOrigin, mapFritzBoxSmartHomeOverview } from "./fritzbox-smarthome.js";
import type { Device, FritzBoxSmartHomeSettings } from "./types.js";

const disabled: FritzBoxSmartHomeSettings = { enabled: false, thermostats: false, outlets: false, lights: false, sensors: false };
const enabled: FritzBoxSmartHomeSettings = { enabled: true, thermostats: true, outlets: true, lights: true, sensors: true };

const overview = {
  devices: [
    { UID: "thermo-parent", name: "Wohnzimmer", productName: "FRITZ!Smart Thermo 302", productCategory: "thermostat", firmwareVersion: "5.20", isConnected: true, batteryValue: 82, isBatteryLow: false },
    { UID: "socket-parent", name: "Steckdose", productName: "FRITZ!Smart Energy 200", productCategory: "socket", isConnected: true },
    { UID: "light-parent", name: "Lampe", productName: "Zigbee Lampe", productCategory: "light", isConnected: true },
    { UID: "sensor-parent", name: "Klima", productName: "Sensor", productCategory: "sensor", isConnected: true, batteryValue: 63, isBatteryLow: false }
  ],
  units: [
    { UID: "thermo-unit", deviceUid: "thermo-parent", name: "Wohnzimmer", isConnected: true, unitType: "thermostat", interfaces: { temperatureInterface: { state: "valid", celsius: 21.3 }, thermostatInterface: { state: "valid", setPointTemperature: { mode: "temperature", celsius: 20 } } } },
    { UID: "socket-unit", deviceUid: "socket-parent", name: "Steckdose", isConnected: true, unitType: "plug", interfaces: { onOffInterface: { state: "valid", active: true }, temperatureInterface: { state: "valid", celsius: 30.5 } } },
    { UID: "light-unit", deviceUid: "light-parent", name: "Lampe", isConnected: true, unitType: "dimmableColorBulb", interfaces: { onOffInterface: { state: "valid", active: false }, levelControlInterface: { state: "valid", level: 42 }, colorControlInterface: { state: "valid" } } },
    { UID: "sensor-unit", deviceUid: "sensor-parent", name: "Klima", isConnected: true, unitType: "sensor", interfaces: { temperatureInterface: { state: "valid", celsius: 19.4 }, humidityInterface: { state: "valid", relativeHumidity: 48 } } }
  ]
};

describe("FRITZ!Box Smart Home core", () => {
  it("keeps the integration completely disabled by default", () => {
    expect(mapFritzBoxSmartHomeOverview(overview, disabled)).toEqual([]);
  });

  it("maps documented Smart Home REST interfaces without enabling HomeKit", () => {
    const devices = mapFritzBoxSmartHomeOverview(overview, enabled, "2026-10-26T12:00:00.000Z");
    expect(devices).toHaveLength(4);
    const thermostat = devices.find(device => device.type === "thermostat")!;
    expect(thermostat.name).toBe("Wohnzimmer");
    expect(thermostat.state).toMatchObject({ temperature: 21.3, targetTemperature: 20, battery: 82, lowBattery: false });
    expect(thermostat.capabilities).toEqual(["setTargetTemperature"]);
    expect(thermostat.homekitEnabled).toBe(false);
    const outlet = devices.find(device => device.type === "outlet")!;
    expect(outlet.state).toMatchObject({ on: true, temperature: 30.5 });
    expect(outlet.capabilities).toEqual(["turnOn", "turnOff", "toggle"]);
    const light = devices.find(device => device.type === "light")!;
    expect(light.state).toMatchObject({ on: false, brightness: 42 });
    expect(light.capabilities).toContain("setBrightness");
    const sensor = devices.find(device => device.type === "genericSensor")!;
    expect(sensor.state).toMatchObject({ temperature: 19.4, humidity: 48, battery: 63 });
  });

  it("respects individual category opt-ins", () => {
    const devices = mapFritzBoxSmartHomeOverview(overview, { ...disabled, enabled: true, thermostats: true });
    expect(devices).toHaveLength(1);
    expect(devices[0]?.type).toBe("thermostat");
  });

  it("derives the web origin from the existing TR-064 endpoint", () => {
    expect(fritzBoxWebOrigin("http://192.168.178.1:49000")).toBe("http://192.168.178.1");
    expect(fritzBoxWebOrigin("https://fritz.box:49443")).toBe("https://fritz.box");
  });

  it("implements the documented PBKDF2 SID response shape", () => {
    const challenge = "2$60000$bc2fb16126ab227e004015d24c1849b2$6000$0a9cd1ef5dc0504377fa78d9c661e1fd";
    const password = "test-password";
    const first = pbkdf2Sync(Buffer.from(password, "utf8"), Buffer.from("bc2fb16126ab227e004015d24c1849b2", "hex"), 60000, 32, "sha256");
    const second = pbkdf2Sync(first, Buffer.from("0a9cd1ef5dc0504377fa78d9c661e1fd", "hex"), 6000, 32, "sha256").toString("hex");
    expect(fritzBoxSidResponse(challenge, password)).toBe(`0a9cd1ef5dc0504377fa78d9c661e1fd$${second}`);
  });
});

describe("FRITZ!Box Smart Home adapter", () => {
  it("does not perform network access while the feature is disabled", async () => {
    const request = vi.fn();
    const registry = { all: () => [] as Device[], set: vi.fn(), get: vi.fn() } as never;
    const adapter = new FritzBoxSmartHomeAdapter(registry, {
      loadSettings: async () => disabled,
      loadConnection: async () => ({ baseUrl: "http://fritz.box:49000", username: "user", password: "secret", enabled: true, pollIntervalSeconds: 30, absenceDelaySeconds: 300, tlsInsecure: false }),
      request,
      log: vi.fn(async () => undefined)
    });
    await adapter.reconcile();
    expect(request).not.toHaveBeenCalled();
    expect(adapter.status()).toMatchObject({ enabled: false, connected: false, deviceCount: 0 });
  });

  it("writes the documented thermostat REST payload", async () => {
    const calls: Array<{url:string;method:string;body?:string}> = [];
    const request = vi.fn(async (url: string, method: string, _headers: Record<string,string>, body?: string) => {
      calls.push({ url, method, body });
      if (url.includes("login_sid.lua") && method === "GET") return { status: 200, headers: {}, text: "<SessionInfo><SID>0123456789abcdef</SID><Challenge>unused</Challenge><BlockTime>0</BlockTime></SessionInfo>" };
      if (url.endsWith("/api/v0/smarthome/overview") && method === "GET") return { status: 200, headers: {}, text: JSON.stringify(overview) };
      if (url.includes("/smarthome/overview/units/") && method === "PUT") return { status: 200, headers: {}, text: "" };
      throw new Error(`unexpected ${method} ${url}`);
    });
    const thermostat = mapFritzBoxSmartHomeOverview(overview, enabled)[0]!;
    let current = thermostat;
    const registry = {
      all: () => [current],
      get: (id: string) => id === current.id ? current : undefined,
      set: vi.fn(async (device: Device) => { if (device.id === current.id) current = { ...current, ...device }; })
    } as never;
    const adapter = new FritzBoxSmartHomeAdapter(registry, {
      loadSettings: async () => enabled,
      loadConnection: async () => ({ baseUrl: "http://fritz.box:49000", username: "user", password: "secret", enabled: false, pollIntervalSeconds: 30, absenceDelaySeconds: 300, tlsInsecure: false }),
      request,
      log: vi.fn(async () => undefined)
    });
    await adapter.command({ deviceId: thermostat.id, capability: "setTargetTemperature", value: 19.5, source: "api" });
    const write = calls.find(call => call.method === "PUT")!;
    expect(write.url).toContain(`/api/v0/smarthome/overview/units/${encodeURIComponent("thermo-unit")}`);
    expect(JSON.parse(write.body!)).toEqual({ interfaces: { thermostatInterface: { setPointTemperature: { mode: "temperature", celsius: 19.5 } } } });
  });
});
