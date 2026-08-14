import { describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";

vi.mock("./db.js", () => ({
  getClimateModeSettings: vi.fn(async () => ({ mode: "winter", winterMode: "auto" })),
  getPushoverConnection: vi.fn(async () => ({ enabled: false, userKey: "", apiToken: "", batteryThreshold: 20, debugEnabled: false })),
  updateClimateModeSettings: vi.fn(async (input) => input),
  updateClimateWinterMode: vi.fn(async (winterMode) => ({ mode: "winter", winterMode })),
  writeSystemLog: vi.fn(async () => undefined)
}));

import { getClimateModeSettings, getPushoverConnection } from "./db.js";
import { ClimateModeManager, thermostatSupportsSystemMode } from "./climate-mode.js";

function thermostat(id: string): Device {
  return {
    id, source: "openccu", sourceId: id, type: "thermostat", name: id, reachable: true,
    state: { controlMode: "auto", targetTemperature: 21 }, capabilities: ["setTargetTemperature"],
    homekitEnabled: false, hidden: false, credentialMode: "none", passwordConfigured: false,
    lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString()
  };
}

describe("global climate mode", () => {
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

  it("stores the configured winter mode without sending thermostat commands", async () => {
    const devices = [thermostat("t1")];
    const command = vi.fn(async () => devices[0]!);
    const manager = new ClimateModeManager({ all: () => devices } as never, { command });
    await manager.setWinterMode("manual");
    expect(command).not.toHaveBeenCalled();
  });

  it.each(["manual", "auto"] as const)("sets winter mode to %s", async winterMode => {
    const devices = [thermostat("t1")];
    const command = vi.fn(async () => devices[0]!);
    const manager = new ClimateModeManager({ all: () => devices } as never, { command });
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "winter", winterMode });
    await manager.setWinterMode(winterMode);
    await manager.apply("winter");
    expect(command).toHaveBeenCalledWith({ deviceId: "t1", capability: "setThermostatMode", value: winterMode, source: "system" });
  });
  it("repairs thermostat mode drift while summer mode is active", async () => {
    const off = thermostat("off");
    off.state.controlMode = "off";
    off.state.targetTemperature = 4.5;
    const drifted = thermostat("drifted");
    drifted.state.controlMode = "manual";
    const devices = [off, drifted];
    const command = vi.fn(async ({ deviceId }) => devices.find(device => device.id === deviceId)!);
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "summer", winterMode: "auto" });
    const manager = new ClimateModeManager({ all: () => devices } as never, { command });

    const result = await manager.verifySummerThermostats();

    expect(result).toEqual({ mode: "summer", checked: 2, mismatched: 1, corrected: 1, failed: 0 });
    expect(command).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledWith({ deviceId: "drifted", capability: "setThermostatMode", value: "off", source: "system" });
  });

  it("does not run the thermostat guard while winter mode is active", async () => {
    const devices = [thermostat("t1")];
    const command = vi.fn(async () => devices[0]!);
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "winter", winterMode: "auto" });
    const manager = new ClimateModeManager({ all: () => devices } as never, { command });

    expect(await manager.verifySummerThermostats()).toEqual({ mode: "winter", checked: 0, mismatched: 0, corrected: 0, failed: 0 });
    expect(command).not.toHaveBeenCalled();
  });

  it("sends a Pushover debug message when the summer guard corrects drift", async () => {
    const drifted = thermostat("drifted");
    drifted.name = "Wohnzimmer Heizung";
    drifted.state.controlMode = "auto";
    const command = vi.fn(async () => drifted);
    const sender = vi.fn(async () => undefined);
    vi.mocked(getClimateModeSettings).mockResolvedValue({ mode: "summer", winterMode: "auto" });
    vi.mocked(getPushoverConnection).mockResolvedValue({ enabled: false, userKey: "user", apiToken: "token", batteryThreshold: 20, debugEnabled: true });
    const manager = new ClimateModeManager({ all: () => [drifted] } as never, { command }, sender);

    await manager.verifySummerThermostats();

    expect(sender).toHaveBeenCalledTimes(1);
    expect(sender.mock.calls[0]?.[0].title).toContain("Sommermodus korrigiert");
    expect(sender.mock.calls[0]?.[0].message).toContain("Wohnzimmer Heizung");
  });

});
