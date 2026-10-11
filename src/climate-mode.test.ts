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

function thermostat(id: string, controlMode = "auto", interfaceName = "BidCos-RF"): Device {
  return {
    id, source: "openccu", sourceId: id, type: "thermostat", name: id, reachable: true,
    state: { controlMode, targetTemperature: controlMode === "off" ? 4.5 : 21 }, capabilities: ["setTargetTemperature", "setThermostatMode"],
    homekitEnabled: false, hidden: false, credentialMode: "none", passwordConfigured: false,
    lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString(),
    adapterData: { interfaceName, channelAddress: `${id}:4` }
  };
}

describe("global climate mode", () => {
  it("checks thermostat mode once per hour", () => {
    expect(CLIMATE_GUARD_INTERVAL_MS).toBe(60 * 60 * 1000);
  });

  it("recognizes physical classic HomeMatic thermostats", () => {
    expect(thermostatSupportsSystemMode(thermostat("HM-RT"))).toBe(true);
  });

  it("excludes OpenCCU VirtualDevices heating groups from global mode commands", () => {
    expect(thermostatSupportsSystemMode(thermostat("HM-GROUP", "auto", "VirtualDevices"))).toBe(false);
  });

  it("switches only mismatched physical thermostats to off in summer mode", async () => {
    const alreadyOff = thermostat("off", "off");
    const manual = thermostat("manual", "manual");
    const virtualGroup = thermostat("group", "manual", "VirtualDevices");
    const devices = [alreadyOff, manual, virtualGroup];
    const command = vi.fn(async ({ deviceId }) => devices.find(device => device.id === deviceId)!);
    const manager = new ClimateModeManager({ all: () => devices } as never, { command });
    const status = await manager.apply("summer");
    expect(command).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledWith({ deviceId: "manual", capability: "setThermostatMode", value: "off", source: "system" });
    expect(status.supportedThermostats).toBe(2);
  });

  it("switches mismatched physical thermostats to manual when winter is explicitly applied", async () => {
    const alreadyManual = thermostat("manual", "manual");
    const automatic = thermostat("auto", "auto");
    const off = thermostat("off", "off");
    const virtualGroup = thermostat("group", "auto", "VirtualDevices");
    const devices = [alreadyManual, automatic, off, virtualGroup];
    const command = vi.fn(async ({ deviceId }) => devices.find(device => device.id === deviceId)!);
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "winter", winterMode: "auto" });
    const manager = new ClimateModeManager({ all: () => devices } as never, { command });

    await manager.apply("winter");

    expect(command).toHaveBeenCalledTimes(2);
    expect(command).toHaveBeenCalledWith({ deviceId: "auto", capability: "setThermostatMode", value: "manual", source: "system" });
    expect(command).toHaveBeenCalledWith({ deviceId: "off", capability: "setThermostatMode", value: "manual", source: "system" });
    expect(command).not.toHaveBeenCalledWith(expect.objectContaining({ deviceId: "manual" }));
    expect(command).not.toHaveBeenCalledWith(expect.objectContaining({ deviceId: "group" }));
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

  it("repairs only accidental auto mode while winter mode is active", async () => {
    const manual = thermostat("manual", "manual");
    const auto = thermostat("auto", "auto");
    const off = thermostat("off", "off");
    const boost = thermostat("boost", "boost");
    const virtualGroup = thermostat("group", "auto", "VirtualDevices");
    const devices = [manual, auto, off, boost, virtualGroup];
    const command = vi.fn(async ({ deviceId }) => devices.find(device => device.id === deviceId)!);
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "winter", winterMode: "auto" });
    const manager = new ClimateModeManager({ all: () => devices } as never, { command });

    const result = await manager.verifyThermostats();

    expect(result).toEqual({ mode: "winter", targetMode: "manual", checked: 4, mismatched: 1, corrected: 1, failed: 0 });
    expect(command).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledWith({ deviceId: "auto", capability: "setThermostatMode", value: "manual", source: "system" });
    expect(command).not.toHaveBeenCalledWith(expect.objectContaining({ deviceId: "off" }));
    expect(command).not.toHaveBeenCalledWith(expect.objectContaining({ deviceId: "boost" }));
    expect(command).not.toHaveBeenCalledWith(expect.objectContaining({ deviceId: "group" }));
  });

  it("ignores unknown thermostat modes in the hourly guard to avoid repeated radio writes", async () => {
    const unknown = thermostat("unknown", "mystery");
    const command = vi.fn();
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "winter", winterMode: "manual" });
    const manager = new ClimateModeManager({ all: () => [unknown] } as never, { command: command as never });

    const result = await manager.verifyThermostats();

    expect(result.mismatched).toBe(0);
    expect(command).not.toHaveBeenCalled();
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
