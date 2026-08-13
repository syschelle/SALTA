import { describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";

vi.mock("./db.js", () => ({
  getClimateModeSettings: vi.fn(async () => ({ mode: "winter", winterMode: "auto" })),
  updateClimateModeSettings: vi.fn(async (input) => input),
  updateClimateWinterMode: vi.fn(async (winterMode) => ({ mode: "winter", winterMode })),
  writeSystemLog: vi.fn(async () => undefined)
}));

import { getClimateModeSettings } from "./db.js";
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
});
