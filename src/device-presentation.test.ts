import { describe, expect, it } from "vitest";
import type { Device } from "./types.js";
import { homeKitAccessoryName, isHomeKitSupportedDevice, resolvePresentationType, supportsPresentationOverride } from "./device-presentation.js";

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: "shelly:test",
    source: "shelly",
    sourceId: "test",
    type: "switch",
    presentationType: "auto",
    name: "Test",
    reachable: true,
    state: { on: false },
    capabilities: ["turnOn", "turnOff", "toggle"],
    homekitEnabled: true,
    credentialMode: "none",
    passwordConfigured: false,
    lastSeen: new Date(0).toISOString(),
    lastEvent: new Date(0).toISOString(),
    ...overrides
  };
}

describe("device presentation types", () => {
  it("keeps the detected type in automatic mode", () => {
    expect(resolvePresentationType(device({ type: "outlet" }))).toBe("outlet");
  });

  it("allows an on/off relay to be presented as a light or fan", () => {
    expect(supportsPresentationOverride(device())).toBe(true);
    expect(resolvePresentationType(device({ presentationType: "light" }))).toBe("light");
    expect(resolvePresentationType(device({ presentationType: "fan" }))).toBe("fan");
  });

  it("ignores presentation overrides for non-switchable meters", () => {
    const meter = device({
      type: "energyMeter",
      presentationType: "fan",
      state: { totalPower: 400 },
      capabilities: []
    });
    expect(supportsPresentationOverride(meter)).toBe(false);
    expect(resolvePresentationType(meter)).toBe("energyMeter");
  });
  it("exposes only device types implemented by the current HomeKit bridge", () => {
    expect(isHomeKitSupportedDevice(device())).toBe(true);
    expect(isHomeKitSupportedDevice(device({ type: "energyMeter", capabilities: [] }))).toBe(false);
    expect(isHomeKitSupportedDevice(device({ type: "windowCovering", capabilities: ["setTargetPosition"] }))).toBe(true);
  });

  it("requires complete thermostat control before publishing a thermostat", () => {
    const thermostat = device({ type: "thermostat", state: { temperature: 21, targetTemperature: 22, controlMode: "auto" } });
    expect(isHomeKitSupportedDevice({ ...thermostat, capabilities: ["setTargetTemperature"] })).toBe(false);
    expect(isHomeKitSupportedDevice({ ...thermostat, capabilities: ["setTargetTemperature", "setThermostatMode"] })).toBe(true);
  });

  it("publishes supported read-only sensors only when their primary state is available", () => {
    expect(isHomeKitSupportedDevice(device({ type: "motionSensor", capabilities: [], state: { motion: false } }))).toBe(true);
    expect(isHomeKitSupportedDevice(device({ type: "contactSensor", capabilities: [], state: { open: true } }))).toBe(true);
    expect(isHomeKitSupportedDevice(device({ type: "temperatureSensor", capabilities: [], state: { temperature: 20.5 } }))).toBe(true);
    expect(isHomeKitSupportedDevice(device({ type: "humiditySensor", capabilities: [], state: { humidity: 52 } }))).toBe(true);
    expect(isHomeKitSupportedDevice(device({ type: "lightSensor", capabilities: [], state: { lux: 120 } }))).toBe(true);
    expect(isHomeKitSupportedDevice(device({ type: "waterLeakSensor", capabilities: [], state: { water: false } }))).toBe(true);
    expect(isHomeKitSupportedDevice(device({ type: "smokeSensor", capabilities: [], state: { fire: false } }))).toBe(true);
    expect(isHomeKitSupportedDevice(device({ type: "motionSensor", capabilities: [], state: {} }))).toBe(false);
  });

  it("uses an optional HomeKit name override without changing the SALTA device name", () => {
    expect(homeKitAccessoryName(device())).toBe("Test");
    expect(homeKitAccessoryName(device({ homekitName: "Fernseher" }))).toBe("Fernseher");
  });

});
