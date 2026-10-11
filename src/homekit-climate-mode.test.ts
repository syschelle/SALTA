import { describe, expect, it } from "vitest";
import type { Device } from "./types.js";
import { homeKitClimateModeForSwitchValue, isHomeKitClimateModeSwitch } from "./homekit.js";

function climateDevice(): Device {
  return {
    id: "system:climate-mode",
    source: "system",
    sourceId: "climate-mode",
    type: "switch",
    presentationType: "switch",
    name: "Heizmodus",
    reachable: true,
    state: { mode: "winter", winterMode: "manual", winterActive: true, on: true },
    capabilities: ["setClimateMode", "turnOn", "turnOff"],
    homekitEnabled: true,
    homekitName: "Wintermodus",
    hidden: true,
    credentialMode: "none",
    passwordConfigured: false,
    lastSeen: new Date().toISOString(),
    lastEvent: new Date().toISOString(),
    adapterData: { systemKind: "climateMode" }
  };
}

describe("HomeKit heating mode switch", () => {
  it("recognizes only the SALTA climate mode system device", () => {
    const device = climateDevice();
    expect(isHomeKitClimateModeSwitch(device)).toBe(true);
    expect(isHomeKitClimateModeSwitch({ ...device, id: "virtual:test", source: "virtual" })).toBe(false);
  });

  it("maps HomeKit ON to Winter and OFF to Summer", () => {
    const device = climateDevice();
    expect(homeKitClimateModeForSwitchValue(device, true)).toBe("winter");
    expect(homeKitClimateModeForSwitchValue(device, 1)).toBe("winter");
    expect(homeKitClimateModeForSwitchValue(device, false)).toBe("summer");
    expect(homeKitClimateModeForSwitchValue(device, 0)).toBe("summer");
  });
});
