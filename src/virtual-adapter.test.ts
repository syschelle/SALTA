import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";

const registry = {
  restore: vi.fn(),
  set: vi.fn(async () => undefined),
  get: vi.fn(),
  remove: vi.fn(async () => true)
};

import { VirtualDeviceAdapter } from "./virtual-adapter.js";

describe("VirtualDeviceAdapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a persistent HomeKit-enabled virtual switch", async () => {
    const adapter = new VirtualDeviceAdapter(registry as never);
    const device = await adapter.createSwitch("Virtual light", "11111111-1111-4111-8111-111111111111", "Living room");
    expect(device).toMatchObject({
      source: "virtual",
      type: "switch",
      name: "Virtual light",
      room: "Living room",
      state: { on: false },
      capabilities: ["toggle", "turnOn", "turnOff"],
      homekitEnabled: true
    });
    expect(registry.set).toHaveBeenCalledWith(device);
  });

  it("updates switch state through the same registry used by SALTA and HomeKit", async () => {
    const current = {
      id: "virtual:test", source: "virtual", sourceId: "test", type: "switch", name: "Virtual",
      reachable: true, state: { on: false }, capabilities: ["toggle", "turnOn", "turnOff"],
      homekitEnabled: true, hidden: false, credentialMode: "none", passwordConfigured: false,
      lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString()
    } as Device;
    registry.get.mockReturnValue(current);
    const adapter = new VirtualDeviceAdapter(registry as never);
    const updated = await adapter.command({ deviceId: current.id, capability: "turnOn", source: "api" });
    expect(updated.state.on).toBe(true);
    expect(registry.set).toHaveBeenCalledWith(expect.objectContaining({ state: expect.objectContaining({ on: true }) }));
  });
});
