import { describe, expect, it } from "vitest";
import type { Device } from "./types.js";
import { resolvePresentationType, supportsPresentationOverride } from "./device-presentation.js";

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
});
