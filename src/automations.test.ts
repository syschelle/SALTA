import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { AutomationEngine, encodeAutomationEventTrigger, type AutomationInput, type AutomationRule, type AutomationStore } from "./automations.js";
import type { Device, DeviceState } from "./types.js";

function device(id: string, state: DeviceState, capabilities: string[] = []): Device {
  return {
    id,
    source: "virtual",
    sourceId: id,
    type: capabilities.length ? "switch" : "motionSensor",
    name: id,
    reachable: true,
    state,
    capabilities,
    homekitEnabled: false,
    hidden: false,
    credentialMode: "none",
    passwordConfigured: false,
    lastSeen: new Date().toISOString(),
    lastEvent: new Date().toISOString()
  };
}

class TestRegistry extends EventEmitter {
  devices = new Map<string, Device>();
  all(): Device[] { return [...this.devices.values()]; }
  get(id: string): Device | undefined { return this.devices.get(id); }
  publish(next: Device): void { this.devices.set(next.id, next); this.emit("device", next); }
}

function memoryStore(): AutomationStore {
  const rules: AutomationRule[] = [];
  return {
    list: vi.fn(async () => [...rules]),
    create: vi.fn(async (input: AutomationInput) => {
      const now = new Date().toISOString();
      const rule = { id: `rule-${rules.length + 1}`, ...input, createdAt: now, updatedAt: now };
      rules.push(rule);
      return rule;
    }),
    update: vi.fn(async (id: string, input: AutomationInput) => {
      const index = rules.findIndex(rule => rule.id === id);
      if (index < 0) return undefined;
      const next = { ...rules[index]!, ...input, updatedAt: new Date().toISOString() };
      rules[index] = next;
      return next;
    }),
    remove: vi.fn(async (id: string) => {
      const index = rules.findIndex(rule => rule.id === id);
      if (index < 0) return false;
      rules.splice(index, 1);
      return true;
    }),
    markTriggered: vi.fn(async (id: string, at: string) => {
      const rule = rules.find(item => item.id === id);
      if (rule) rule.lastTriggeredAt = at;
    })
  };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe("AutomationEngine", () => {
  it("runs an action only on the configured state transition and honors a device condition", async () => {
    const registry = new TestRegistry();
    registry.devices.set("motion", device("motion", { motion: false }));
    registry.devices.set("condition", device("condition", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const command = vi.fn(async () => registry.get("target")!);
    const engine = new AutomationEngine(registry as never, { command }, memoryStore());
    await engine.start();
    await engine.create({ name: "Motion", enabled: true, triggerDeviceId: "motion", triggerStateKey: "motion", triggerValue: true, conditionDeviceId: "condition", conditionStateKey: "on", conditionValue: true, actionDeviceId: "target", action: "toggle" });

    registry.publish(device("motion", { motion: true }));
    await tick();
    expect(command).not.toHaveBeenCalled();

    registry.publish(device("condition", { on: true }, ["turnOn", "turnOff", "toggle"]));
    registry.publish(device("motion", { motion: false }));
    registry.publish(device("motion", { motion: true }));
    await tick();
    expect(command).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledWith({ deviceId: "target", capability: "toggle", source: "automation" });

    registry.publish(device("motion", { motion: true }));
    await tick();
    expect(command).toHaveBeenCalledTimes(1);
    engine.stop();
  });

  it("supports explicit on, off and toggle actions", async () => {
    for (const action of ["turnOn", "turnOff", "toggle"] as const) {
      const registry = new TestRegistry();
      registry.devices.set("trigger", device("trigger", { on: false }, ["turnOn", "turnOff", "toggle"]));
      registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
      const command = vi.fn(async () => registry.get("target")!);
      const engine = new AutomationEngine(registry as never, { command }, memoryStore());
      await engine.start();
      await engine.create({ name: action, enabled: true, triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true, actionDeviceId: "target", action });
      registry.publish(device("trigger", { on: true }, ["turnOn", "turnOff", "toggle"]));
      await tick();
      expect(command).toHaveBeenCalledWith({ deviceId: "target", capability: action, source: "automation" });
      engine.stop();
    }
  });

  it("preserves optional room metadata and clears it when the room is removed", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const engine = new AutomationEngine(registry as never, { command: vi.fn(async command => registry.get(command.deviceId)!) }, memoryStore());
    await engine.start();
    const rule = await engine.create({ name: "Room rule", enabled: true, roomId: "11111111-1111-4111-8111-111111111111", triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true, actionDeviceId: "target", action: "turnOn" });
    expect(rule.roomId).toBe("11111111-1111-4111-8111-111111111111");
    await engine.setEnabled(rule.id, false);
    expect(engine.list()[0]?.roomId).toBe("11111111-1111-4111-8111-111111111111");
    engine.clearRoomAssignment("11111111-1111-4111-8111-111111111111");
    expect(engine.list()[0]?.roomId).toBeUndefined();
    engine.stop();
  });

  it("requires the optional condition to use a different device than the trigger", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const engine = new AutomationEngine(registry as never, { command: vi.fn(async command => registry.get(command.deviceId)!) }, memoryStore());
    await engine.start();
    await expect(engine.create({
      name: "Same condition", enabled: true,
      triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      conditionDeviceId: "trigger", conditionStateKey: "on", conditionValue: true,
      actionDeviceId: "target", action: "turnOn"
    })).rejects.toThrow("AUTOMATION_CONDITION_TRIGGER_SAME_DEVICE");
    engine.stop();
  });

  it("rejects automation cycles before they can create a toggle loop", async () => {
    const registry = new TestRegistry();
    registry.devices.set("a", device("a", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("b", device("b", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const engine = new AutomationEngine(registry as never, { command: vi.fn(async command => registry.get(command.deviceId)!) }, memoryStore());
    await engine.start();
    await engine.create({ name: "A to B", enabled: true, triggerDeviceId: "a", triggerStateKey: "on", triggerValue: true, actionDeviceId: "b", action: "toggle" });
    await expect(engine.create({ name: "B to A", enabled: true, triggerDeviceId: "b", triggerStateKey: "on", triggerValue: true, actionDeviceId: "a", action: "toggle" })).rejects.toThrow("AUTOMATION_CYCLE_NOT_ALLOWED");
    engine.stop();
  });
  it("fires every received button event even when the raw value is repeated", async () => {
    const registry = new TestRegistry();
    registry.devices.set("button", { ...device("button", { buttonEvent: 1002 }), source: "phoscon", type: "button", adapterData: { buttonEventProtocol: "deconz" } });
    registry.devices.set("condition", device("condition", { on: true }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const command = vi.fn(async () => registry.get("target")!);
    const engine = new AutomationEngine(registry as never, { command }, memoryStore());
    await engine.start();
    await engine.create({
      name: "Aqara click",
      enabled: true,
      triggerDeviceId: "button",
      triggerStateKey: encodeAutomationEventTrigger("buttonEvent", 1002),
      triggerValue: true,
      conditionDeviceId: "condition",
      conditionStateKey: "on",
      conditionValue: true,
      actionDeviceId: "target",
      action: "toggle"
    });

    const event = { deviceId: "button", source: "phoscon", key: "buttonEvent", value: 1002, receivedAt: new Date().toISOString() };
    registry.emit("deviceEvent", event);
    registry.emit("deviceEvent", { ...event, receivedAt: new Date(Date.now() + 1).toISOString() });
    await tick();
    await tick();
    expect(command).toHaveBeenCalledTimes(2);
    engine.stop();
  });

});
