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
  beforeEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

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

  it("creates a HomeKit-writable momentary virtual button", async () => {
    const adapter = new VirtualDeviceAdapter(registry as never);
    const device = await adapter.createButton("Arrived");
    expect(device).toMatchObject({
      source: "virtual",
      type: "switch",
      presentationType: "switch",
      model: "SALTA Virtual Button",
      profile: "button",
      state: { on: false },
      capabilities: ["toggle", "turnOn", "turnOff"],
      homekitEnabled: true,
      adapterData: { virtualType: "button", momentaryResetMs: 500 }
    });
  });

  it("automatically resets a virtual button to off after a short pulse", async () => {
    vi.useFakeTimers();
    let current = {
      id: "virtual:button", source: "virtual", sourceId: "button", type: "switch", presentationType: "switch", name: "Arrived",
      reachable: true, state: { on: false }, capabilities: ["toggle", "turnOn", "turnOff"],
      homekitEnabled: true, hidden: false, credentialMode: "none", passwordConfigured: false,
      lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString(), adapterData: { virtualType: "button", momentaryResetMs: 500 }
    } as Device;
    registry.get.mockImplementation(() => current);
    registry.set.mockImplementation(async device => { current = device as Device; });
    const adapter = new VirtualDeviceAdapter(registry as never);

    const pressed = await adapter.command({ deviceId: current.id, capability: "turnOn", source: "homekit" });
    expect(pressed.state.on).toBe(true);
    expect(current.state.on).toBe(true);

    await vi.advanceTimersByTimeAsync(500);
    expect(current.state.on).toBe(false);
    expect(registry.set).toHaveBeenCalledTimes(2);
  });

  it("converts an existing virtual switch to a button while keeping the same device id", async () => {
    const current = {
      id: "virtual:test", source: "virtual", sourceId: "test", type: "switch", presentationType: "switch", name: "Arrived",
      model: "SALTA Virtual Switch", profile: "switch", reachable: true, state: { on: true }, capabilities: ["toggle", "turnOn", "turnOff"],
      homekitEnabled: true, hidden: false, credentialMode: "none", passwordConfigured: false,
      lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString(), adapterData: { virtualType: "switch" }
    } as Device;
    registry.get.mockReturnValue(current);
    const adapter = new VirtualDeviceAdapter(registry as never);
    const updated = await adapter.updateKind(current.id, "button");
    expect(updated).toMatchObject({ id: current.id, model: "SALTA Virtual Button", profile: "button", state: { on: false }, adapterData: { virtualType: "button", momentaryResetMs: 500 } });
    expect(registry.set).toHaveBeenCalledWith(updated);
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

  it("executes binary commands for legacy persisted virtual records with incomplete metadata", async () => {
    const current = {
      id: "virtual:legacy", source: "virtual", sourceId: "legacy", type: "legacyVirtual", name: "Legacy virtual",
      reachable: true, state: {}, capabilities: [],
      homekitEnabled: false, hidden: false, credentialMode: "none", passwordConfigured: false,
      lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString()
    } as Device;
    registry.get.mockReturnValue(current);
    const adapter = new VirtualDeviceAdapter(registry as never);
    const updated = await adapter.command({ deviceId: current.id, capability: "turnOn", source: "automation" });
    expect(updated.state.on).toBe(true);
    expect(registry.set).toHaveBeenCalledWith(expect.objectContaining({ state: expect.objectContaining({ on: true }) }));
  });

});
