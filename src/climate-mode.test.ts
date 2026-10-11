import { describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";

vi.mock("./db.js", () => ({
  getClimateModeSettings: vi.fn(async () => ({ mode: "winter", winterMode: "manual" })),
  getGeneralSettings: vi.fn(async () => ({ debugLevel: "off" })),
  getPushoverConnection: vi.fn(async () => ({ enabled: false, userKey: "", apiToken: "", batteryThreshold: 20 })),
  updateClimateModeSettings: vi.fn(async (input) => input),
  updateClimateWinterMode: vi.fn(async (winterMode) => ({ mode: "winter", winterMode })),
  writeSystemLog: vi.fn(async () => undefined)
}));

import { getClimateModeSettings, getGeneralSettings, getPushoverConnection } from "./db.js";
import { CLIMATE_GUARD_INTERVAL_MS, ClimateModeManager, thermostatSupportsSystemMode } from "./climate-mode.js";

function thermostat(id: string): Device {
  return {
    id, source: "openccu", sourceId: id, type: "thermostat", name: id, reachable: true,
    state: { controlMode: "auto", targetTemperature: 21 }, capabilities: ["setTargetTemperature"],
    homekitEnabled: false, hidden: false, credentialMode: "none", passwordConfigured: false,
    lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString()
  };
}

describe("global climate mode", () => {
  it("checks thermostat mode once per hour", () => {
    expect(CLIMATE_GUARD_INTERVAL_MS).toBe(60 * 60 * 1000);
  });

  it("recognizes OpenCCU thermostats with inferred mode control", () => {
    expect(thermostatSupportsSystemMode(thermostat("t1"))).toBe(true);
  });

  it("sets every compatible thermostat to off in summer mode", async () => {
    const devices = [thermostat("t1"), thermostat("t2")];
    const command = vi.fn(async ({ deviceId }) => devices.find(device => device.id === deviceId)!);
    const manager = new ClimateModeManager({ all: () => devices } as never, { command });
    const status = await manager.apply("summer");
    expect(command).toHaveBeenCalledTimes(2);
    expect(command).toHaveBeenNthCalledWith(1, { deviceId: "t1", capability: "setThermostatMode", value: "off", source: "system" });
    expect(command).toHaveBeenNthCalledWith(2, { deviceId: "t2", capability: "setThermostatMode", value: "off", source: "system" });
    expect(status.supportedThermostats).toBe(2);
  });

  it("sets every compatible thermostat to manual in winter mode even if an old auto setting remains", async () => {
    const devices = [thermostat("t1"), thermostat("t2")];
    const command = vi.fn(async ({ deviceId }) => devices.find(device => device.id === deviceId)!);
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "winter", winterMode: "auto" });
    const manager = new ClimateModeManager({ all: () => devices } as never, { command });

    await manager.apply("winter");

    expect(command).toHaveBeenCalledTimes(2);
    expect(command).toHaveBeenNthCalledWith(1, { deviceId: "t1", capability: "setThermostatMode", value: "manual", source: "system" });
    expect(command).toHaveBeenNthCalledWith(2, { deviceId: "t2", capability: "setThermostatMode", value: "manual", source: "system" });
  });

  it("rejects automatic winter thermostat mode", async () => {
    const devices = [thermostat("t1")];
    const manager = new ClimateModeManager({ all: () => devices } as never, { command: vi.fn() as never });
    await expect(manager.setWinterMode("auto")).rejects.toThrow("AUTOMATIC_THERMOSTAT_MODE_DISABLED");
  });

  it("synchronizes the boolean winterActive state used by automation conditions", async () => {
    let systemDevice: Device = {
      id: "system:climate-mode", source: "system", sourceId: "climate-mode", type: "genericSensor", name: "Heizmodus", reachable: true,
      state: { mode: "winter", winterMode: "manual", winterActive: true }, capabilities: ["setClimateMode"],
      homekitEnabled: false, hidden: true, credentialMode: "none", passwordConfigured: false,
      lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString()
    };
    const set = vi.fn(async (next: Device) => { systemDevice = next; });
    const manager = new ClimateModeManager({ all: () => [systemDevice], get: () => systemDevice, set } as never, { command: vi.fn() as never });
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "winter", winterMode: "manual" });
    await manager.apply("summer");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ state: expect.objectContaining({ mode: "summer", winterMode: "manual", winterActive: false }) }));
  });

  it("repairs thermostat mode drift to off while summer mode is active", async () => {
    const off = thermostat("off");
    off.state.controlMode = "off";
    off.state.targetTemperature = 4.5;
    const drifted = thermostat("drifted");
    drifted.state.controlMode = "manual";
    const devices = [off, drifted];
    const command = vi.fn(async ({ deviceId }) => devices.find(device => device.id === deviceId)!);
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "summer", winterMode: "manual" });
    const manager = new ClimateModeManager({ all: () => devices } as never, { command });

    const result = await manager.verifyThermostats();

    expect(result).toEqual({ mode: "summer", targetMode: "off", checked: 2, mismatched: 1, corrected: 1, failed: 0 });
    expect(command).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledWith({ deviceId: "drifted", capability: "setThermostatMode", value: "off", source: "system" });
  });

  it("repairs thermostat mode drift to manual while winter mode is active", async () => {
    const manual = thermostat("manual");
    manual.state.controlMode = "manual";
    const auto = thermostat("auto");
    auto.state.controlMode = "auto";
    const off = thermostat("off");
    off.state.controlMode = "off";
    const devices = [manual, auto, off];
    const command = vi.fn(async ({ deviceId }) => devices.find(device => device.id === deviceId)!);
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "winter", winterMode: "auto" });
    const manager = new ClimateModeManager({ all: () => devices } as never, { command });

    const result = await manager.verifyThermostats();

    expect(result).toEqual({ mode: "winter", targetMode: "manual", checked: 3, mismatched: 2, corrected: 2, failed: 0 });
    expect(command).toHaveBeenCalledTimes(2);
    expect(command).toHaveBeenCalledWith({ deviceId: "auto", capability: "setThermostatMode", value: "manual", source: "system" });
    expect(command).toHaveBeenCalledWith({ deviceId: "off", capability: "setThermostatMode", value: "manual", source: "system" });
  });

  it("sends a Pushover debug message when the guard corrects drift", async () => {
    const drifted = thermostat("drifted");
    drifted.name = "Wohnzimmer Heizung";
    drifted.state.controlMode = "auto";
    const command = vi.fn(async () => drifted);
    const sender = vi.fn(async () => undefined);
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "winter", winterMode: "manual" });
    vi.mocked(getGeneralSettings).mockResolvedValue({ debugLevel: "verbose" });
    vi.mocked(getPushoverConnection).mockResolvedValue({ enabled: false, userKey: "user", apiToken: "token", batteryThreshold: 20 });
    const manager = new ClimateModeManager({ all: () => [drifted] } as never, { command }, sender);

    await manager.verifyThermostats();

    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0]?.[0].title).toContain("Heizmodus korrigiert");
    expect(sender.mock.calls[0]?.[0].message).toContain("Wohnzimmer Heizung");
  });

  it("does not send a correction notification at DEBUG errors level", async () => {
    const drifted = thermostat("drifted-errors");
    drifted.state.controlMode = "auto";
    const command = vi.fn(async () => drifted);
    const sender = vi.fn(async () => undefined);
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "winter", winterMode: "manual" });
    vi.mocked(getGeneralSettings).mockResolvedValue({ debugLevel: "errors" });
    vi.mocked(getPushoverConnection).mockResolvedValue({ enabled: false, userKey: "user", apiToken: "token", batteryThreshold: 20 });
    const manager = new ClimateModeManager({ all: () => [drifted] } as never, { command }, sender);

    await manager.verifyThermostats();

    expect(sender).not.toHaveBeenCalled();
  });

  it("sends a failure notification at DEBUG errors level", async () => {
    const drifted = thermostat("failed-errors");
    drifted.state.controlMode = "auto";
    const command = vi.fn(async () => { throw new Error("command failed"); });
    const sender = vi.fn(async () => undefined);
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "winter", winterMode: "manual" });
    vi.mocked(getGeneralSettings).mockResolvedValue({ debugLevel: "errors" });
    vi.mocked(getPushoverConnection).mockResolvedValue({ enabled: false, userKey: "user", apiToken: "token", batteryThreshold: 20 });
    const manager = new ClimateModeManager({ all: () => [drifted] } as never, { command }, sender);

    await manager.verifyThermostats();

    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0]?.[0].title).toContain("Heizmodus Fehler");
  });
});
