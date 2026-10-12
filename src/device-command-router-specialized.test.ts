import { describe, expect, it, vi } from "vitest";
import { DeviceCommandRouter } from "./device-command-router.js";
import type { Device } from "./types.js";

function thermostat(): Device {
  return {
    id: "openccu:BidCos-RF:ABC_3A2",
    source: "openccu",
    sourceId: "BidCos-RF|ABC:2",
    type: "thermostat",
    name: "Test thermostat",
    reachable: true,
    state: { targetTemperature: 15, controlMode: "manual" },
    capabilities: ["setTargetTemperature", "setThermostatMode"],
    homekitEnabled: false,
    hidden: false,
    credentialMode: "none",
    passwordConfigured: false,
    lastSeen: new Date().toISOString(),
    lastEvent: new Date().toISOString()
  };
}

describe("specialized device command routing", () => {
  it("routes only the configured source/type/capability to the isolated controller", async () => {
    const device = thermostat();
    const genericCommand = vi.fn(async () => device);
    const thermostatCommand = vi.fn(async () => ({ ...device, state: { ...device.state, targetTemperature: 18 } }));
    const registry = { get: (id: string) => id === device.id ? device : undefined };
    const router = new DeviceCommandRouter(
      registry as never,
      { openccu: { command: genericCommand } },
      [{
        source: "openccu",
        type: "thermostat",
        capabilities: ["setTargetTemperature", "setThermostatMode"],
        adapter: { command: thermostatCommand }
      }]
    );

    await router.command({ deviceId: device.id, capability: "setTargetTemperature", value: 18, source: "automation" });

    expect(thermostatCommand).toHaveBeenCalledTimes(1);
    expect(genericCommand).not.toHaveBeenCalled();
  });

  it("keeps unrelated capabilities on the normal source adapter", async () => {
    const device = thermostat();
    const genericCommand = vi.fn(async () => device);
    const thermostatCommand = vi.fn(async () => device);
    const registry = { get: () => device };
    const router = new DeviceCommandRouter(
      registry as never,
      { openccu: { command: genericCommand } },
      [{ source: "openccu", type: "thermostat", capabilities: ["setTargetTemperature"], adapter: { command: thermostatCommand } }]
    );

    await router.command({ deviceId: device.id, capability: "customCapability", source: "api" });

    expect(genericCommand).toHaveBeenCalledTimes(1);
    expect(thermostatCommand).not.toHaveBeenCalled();
  });
});
