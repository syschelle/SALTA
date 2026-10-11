import { describe, expect, it } from "vitest";
import type { Device } from "./types.js";
import { homeKitVacationModeForSwitchValue, isHomeKitVacationModeSwitch } from "./homekit.js";

function vacationDevice(): Device {
  return {
    id: "system:vacation-mode",
    source: "system",
    sourceId: "vacation-mode",
    type: "switch",
    presentationType: "switch",
    name: "Urlaubsmodus",
    reachable: true,
    state: { vacationActive: true, on: true },
    capabilities: ["setVacationMode", "turnOn", "turnOff"],
    homekitEnabled: true,
    homekitName: "Urlaub",
    hidden: true,
    credentialMode: "none",
    passwordConfigured: false,
    lastSeen: new Date().toISOString(),
    lastEvent: new Date().toISOString(),
    adapterData: { systemKind: "vacationMode" }
  };
}

describe("HomeKit vacation mode switch", () => {
  it("recognizes only the SALTA vacation mode system device", () => {
    const device = vacationDevice();
    expect(isHomeKitVacationModeSwitch(device)).toBe(true);
    expect(isHomeKitVacationModeSwitch({ ...device, id: "virtual:test", source: "virtual" })).toBe(false);
  });

  it("maps HomeKit ON to vacation enabled and OFF to disabled", () => {
    const device = vacationDevice();
    expect(homeKitVacationModeForSwitchValue(device, true)).toBe(true);
    expect(homeKitVacationModeForSwitchValue(device, 1)).toBe(true);
    expect(homeKitVacationModeForSwitchValue(device, false)).toBe(false);
    expect(homeKitVacationModeForSwitchValue(device, 0)).toBe(false);
  });
});
