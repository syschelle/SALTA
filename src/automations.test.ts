import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { AutomationEngine, encodeAutomationEventTrigger, localAutomationTime, type AutomationInput, type AutomationRule, type AutomationStore } from "./automations.js";
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

  it("runs a daily time trigger once per local day in the configured timezone", async () => {
    vi.useFakeTimers();
    try {
      const registry = new TestRegistry();
      registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
      const command = vi.fn(async () => registry.get("target")!);
      const store = memoryStore();
      let now = new Date("2026-08-15T05:29:50.000Z");
      const engine = new AutomationEngine(registry as never, { command }, store, undefined, {
        now: () => now, intervalMs: 1_000, timeZone: "Europe/Berlin"
      });
      await engine.start();
      await engine.create({
        name: "Morning light", enabled: true, triggerType: "time", triggerTime: "07:30",
        triggerDeviceId: "target", triggerStateKey: "__time__", triggerValue: true,
        actionDeviceId: "target", action: "turnOn"
      });

      now = new Date("2026-08-15T05:30:00.000Z");
      await vi.advanceTimersByTimeAsync(1_000);
      await Promise.resolve();
      expect(command).toHaveBeenCalledTimes(1);
      expect(command).toHaveBeenLastCalledWith({ deviceId: "target", capability: "turnOn", source: "automation" });

      now = new Date("2026-08-15T05:30:40.000Z");
      await vi.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
      expect(command).toHaveBeenCalledTimes(1);

      now = new Date("2026-08-16T05:30:00.000Z");
      await vi.advanceTimersByTimeAsync(1_000);
      await Promise.resolve();
      expect(command).toHaveBeenCalledTimes(2);
      engine.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies the global heating mode through a SALTA system action", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("system:climate-mode", {
      ...device("system:climate-mode", { mode: "winter" }),
      source: "system",
      type: "genericSensor",
      capabilities: ["setClimateMode"],
      adapterData: { systemKind: "climateMode" }
    });
    const command = vi.fn(async () => registry.get("trigger")!);
    const applyClimateMode = vi.fn(async () => undefined);
    const engine = new AutomationEngine(registry as never, { command }, memoryStore(), undefined, {}, { applyClimateMode });
    await engine.start();
    await engine.create({
      name: "Summer mode", enabled: true,
      triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "system:climate-mode", action: "climateSummer"
    });
    registry.publish(device("trigger", { on: true }, ["turnOn", "turnOff", "toggle"]));
    await tick();
    expect(applyClimateMode).toHaveBeenCalledTimes(1);
    expect(applyClimateMode).toHaveBeenCalledWith("summer");
    expect(command).not.toHaveBeenCalled();
    engine.stop();
  });

  it("keeps a time trigger tied to local wall-clock time across daylight-saving offsets", () => {
    expect(localAutomationTime(new Date("2026-01-15T06:30:00.000Z"), "Europe/Berlin")).toEqual({ dateKey: "2026-01-15", time: "07:30" });
    expect(localAutomationTime(new Date("2026-08-15T05:30:00.000Z"), "Europe/Berlin")).toEqual({ dateKey: "2026-08-15", time: "07:30" });
  });

  it("uses Phoscon daylight and dark states as automation triggers and conditions", async () => {
    const registry = new TestRegistry();
    registry.devices.set("daylight", { ...device("daylight", { daylight: true, dark: false }), source: "phoscon", type: "lightSensor", model: "PHDL00" });
    registry.devices.set("motion", device("motion", { motion: false }));
    registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const command = vi.fn(async () => registry.get("target")!);
    const engine = new AutomationEngine(registry as never, { command }, memoryStore());
    await engine.start();
    await engine.create({
      name: "Night motion", enabled: true,
      triggerDeviceId: "motion", triggerStateKey: "motion", triggerValue: true,
      conditionDeviceId: "daylight", conditionStateKey: "dark", conditionValue: true,
      actionDeviceId: "target", action: "turnOn"
    });
    await engine.create({
      name: "Daylight ended", enabled: true,
      triggerDeviceId: "daylight", triggerStateKey: "daylight", triggerValue: false,
      actionDeviceId: "target", action: "toggle"
    });

    registry.publish({ ...device("daylight", { daylight: false, dark: true }), source: "phoscon", type: "lightSensor", model: "PHDL00" });
    await tick();
    expect(command).toHaveBeenCalledWith({ deviceId: "target", capability: "toggle", source: "automation" });

    registry.publish(device("motion", { motion: true }));
    await tick();
    expect(command).toHaveBeenCalledWith({ deviceId: "target", capability: "turnOn", source: "automation" });
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

  it("treats multiple trigger devices as an OR group without requiring both states", async () => {
    const registry = new TestRegistry();
    registry.devices.set("left", device("left", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("right", device("right", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const command = vi.fn(async () => registry.get("target")!);
    const engine = new AutomationEngine(registry as never, { command }, memoryStore());
    await engine.start();
    await engine.create({
      name: "Two wall switches", enabled: true,
      triggerDeviceId: "left", triggerStateKey: "on", triggerValue: true,
      additionalTriggers: [{ deviceId: "right", stateKey: "on", value: true }],
      actionDeviceId: "target", action: "toggle"
    });

    registry.publish(device("right", { on: true }, ["turnOn", "turnOff", "toggle"]));
    await tick();
    expect(command).toHaveBeenCalledTimes(1);

    registry.publish(device("left", { on: true }, ["turnOn", "turnOff", "toggle"]));
    await tick();
    expect(command).toHaveBeenCalledTimes(2);
    engine.stop();
  });

  it("supports a realtime button event as an additional OR trigger", async () => {
    const registry = new TestRegistry();
    registry.devices.set("switch", device("switch", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("button", { ...device("button", { buttonEvent: 1002 }), source: "phoscon", type: "button", adapterData: { buttonEventProtocol: "deconz" } });
    registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const command = vi.fn(async () => registry.get("target")!);
    const engine = new AutomationEngine(registry as never, { command }, memoryStore());
    await engine.start();
    await engine.create({
      name: "Switch or button", enabled: true,
      triggerDeviceId: "switch", triggerStateKey: "on", triggerValue: true,
      additionalTriggers: [{ deviceId: "button", stateKey: encodeAutomationEventTrigger("buttonEvent", 1002), value: true }],
      actionDeviceId: "target", action: "toggle"
    });
    registry.emit("deviceEvent", { deviceId: "button", source: "phoscon", key: "buttonEvent", value: 1002, receivedAt: new Date().toISOString() });
    await tick();
    expect(command).toHaveBeenCalledTimes(1);
    engine.stop();
  });

  it("includes additional OR triggers in cycle protection", async () => {
    const registry = new TestRegistry();
    for (const id of ["a", "b", "c"]) registry.devices.set(id, device(id, { on: false }, ["turnOn", "turnOff", "toggle"]));
    const engine = new AutomationEngine(registry as never, { command: vi.fn(async command => registry.get(command.deviceId)!) }, memoryStore());
    await engine.start();
    await engine.create({ name: "A to B", enabled: true, triggerDeviceId: "a", triggerStateKey: "on", triggerValue: true, actionDeviceId: "b", action: "toggle" });
    await expect(engine.create({
      name: "C or B to A", enabled: true,
      triggerDeviceId: "c", triggerStateKey: "on", triggerValue: true,
      additionalTriggers: [{ deviceId: "b", stateKey: "on", value: true }],
      actionDeviceId: "a", action: "toggle"
    })).rejects.toThrow("AUTOMATION_CYCLE_NOT_ALLOWED");
    engine.stop();
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

  it("executes all configured target actions for one trigger", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target-a", device("target-a", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target-b", device("target-b", { on: true }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target-c", device("target-c", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const command = vi.fn(async commandInput => registry.get(commandInput.deviceId)!);
    const store = memoryStore();
    const engine = new AutomationEngine(registry as never, { command }, store);
    await engine.start();
    await engine.create({
      name: "Multi target", enabled: true,
      triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "target-a", action: "turnOn",
      additionalActions: [
        { deviceId: "target-b", action: "turnOff" },
        { deviceId: "target-c", action: "toggle" }
      ]
    });

    registry.publish(device("trigger", { on: true }, ["turnOn", "turnOff", "toggle"]));
    await tick();
    await tick();
    expect(command).toHaveBeenCalledTimes(3);
    expect(command.mock.calls.map(call => call[0])).toEqual([
      { deviceId: "target-a", capability: "turnOn", source: "automation" },
      { deviceId: "target-b", capability: "turnOff", source: "automation" },
      { deviceId: "target-c", capability: "toggle", source: "automation" }
    ]);
    expect(store.markTriggered).toHaveBeenCalledTimes(1);
    engine.stop();
  });

  it("continues with remaining targets when one target action fails", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target-a", device("target-a", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target-b", device("target-b", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const command = vi.fn(async commandInput => {
      if (commandInput.deviceId === "target-a") throw new Error("TEST_FAILURE");
      return registry.get(commandInput.deviceId)!;
    });
    const logger = { write: vi.fn(async () => undefined) };
    const store = memoryStore();
    const engine = new AutomationEngine(registry as never, { command }, store, logger);
    await engine.start();
    await engine.create({
      name: "Partial failure", enabled: true,
      triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "target-a", action: "turnOn",
      additionalActions: [{ deviceId: "target-b", action: "turnOn" }]
    });

    registry.publish(device("trigger", { on: true }, ["turnOn", "turnOff", "toggle"]));
    await tick();
    await tick();
    expect(command).toHaveBeenCalledTimes(2);
    expect(store.markTriggered).toHaveBeenCalledTimes(1);
    expect(logger.write).toHaveBeenCalledWith("error", "automation", "AUTOMATION_ACTION_FAILED", "Automation action failed", expect.objectContaining({ actionDeviceId: "target-a" }));
    expect(logger.write).toHaveBeenCalledWith("info", "automation", "AUTOMATION_TRIGGERED", "Automation executed", expect.objectContaining({ successfulActions: 1, failedActions: 1 }));
    engine.stop();
  });

  it("rejects duplicate, unsafe trigger-equal and excessive target actions", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", { ...device("trigger", { on: false }, ["turnOn", "turnOff", "toggle"]), source: "shelly" });
    for (let index = 1; index <= 9; index += 1) registry.devices.set(`target-${index}`, device(`target-${index}`, { on: false }, ["turnOn", "turnOff", "toggle"]));
    const engine = new AutomationEngine(registry as never, { command: vi.fn(async commandInput => registry.get(commandInput.deviceId)!) }, memoryStore());
    await engine.start();
    await expect(engine.create({
      name: "Duplicate target", enabled: true, triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "target-1", action: "turnOn", additionalActions: [{ deviceId: "target-1", action: "turnOff" }]
    })).rejects.toThrow("AUTOMATION_ACTION_DUPLICATE_DEVICE");
    await expect(engine.create({
      name: "Trigger target", enabled: true, triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "target-1", action: "turnOn", additionalActions: [{ deviceId: "trigger", action: "turnOff" }]
    })).rejects.toThrow("AUTOMATION_TRIGGER_ACTION_SAME_DEVICE");
    await expect(engine.create({
      name: "Too many targets", enabled: true, triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "target-1", action: "turnOn",
      additionalActions: Array.from({ length: 8 }, (_, index) => ({ deviceId: `target-${index + 2}`, action: "turnOn" as const }))
    })).rejects.toThrow("AUTOMATION_ACTION_LIMIT");
    engine.stop();
  });

  it("allows a virtual latch trigger to reset itself to the opposite state after other targets", async () => {
    const registry = new TestRegistry();
    const virtual = { ...device("virtual-geofence", { on: false }, ["turnOn", "turnOff", "toggle"]), source: "virtual" as const, type: "switch" as const };
    registry.devices.set(virtual.id, virtual);
    registry.devices.set("lamp", { ...device("lamp", { on: false }, ["turnOn", "turnOff", "toggle"]), source: "shelly" });
    const calls: string[] = [];
    const command = vi.fn(async commandInput => {
      calls.push(`${commandInput.deviceId}:${commandInput.capability}`);
      const current = registry.get(commandInput.deviceId)!;
      if (commandInput.deviceId === virtual.id && commandInput.capability === "turnOff") {
        const updated = { ...current, state: { ...current.state, on: false } };
        registry.publish(updated);
        return updated;
      }
      return current;
    });
    const store = memoryStore();
    const engine = new AutomationEngine(registry as never, { command }, store);
    await engine.start();
    await engine.create({
      name: "Consume geofence latch", enabled: true,
      triggerDeviceId: virtual.id, triggerStateKey: "on", triggerValue: true,
      actionDeviceId: virtual.id, action: "turnOff",
      additionalActions: [{ deviceId: "lamp", action: "turnOn" }]
    });

    registry.publish({ ...virtual, state: { on: true } });
    await tick();
    await tick();
    await tick();

    expect(calls).toEqual(["lamp:turnOn", "virtual-geofence:turnOff"]);
    expect(command).toHaveBeenCalledTimes(2);
    expect(registry.get(virtual.id)?.state.on).toBe(false);
    expect(store.markTriggered).toHaveBeenCalledTimes(1);
    engine.stop();
  });

  it("rejects unsafe same-device actions for a virtual trigger", async () => {
    const registry = new TestRegistry();
    const virtual = { ...device("virtual-geofence", { on: false }, ["turnOn", "turnOff", "toggle"]), source: "virtual" as const, type: "switch" as const };
    registry.devices.set(virtual.id, virtual);
    const engine = new AutomationEngine(registry as never, { command: vi.fn(async commandInput => registry.get(commandInput.deviceId)!) }, memoryStore());
    await engine.start();

    await expect(engine.create({
      name: "Unsafe keep-on", enabled: true,
      triggerDeviceId: virtual.id, triggerStateKey: "on", triggerValue: true,
      actionDeviceId: virtual.id, action: "turnOn"
    })).rejects.toThrow("AUTOMATION_TRIGGER_ACTION_SAME_DEVICE");

    await expect(engine.create({
      name: "Unsafe toggle", enabled: true,
      triggerDeviceId: virtual.id, triggerStateKey: "on", triggerValue: true,
      actionDeviceId: virtual.id, action: "toggle"
    })).rejects.toThrow("AUTOMATION_TRIGGER_ACTION_SAME_DEVICE");
    engine.stop();
  });


  it("accepts virtual switches as automation targets even when an older persisted record lacks binary capability metadata", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { motion: false }));
    registry.devices.set("virtual-target", { ...device("virtual-target", {}), source: "virtual", type: "legacyVirtual", presentationType: "auto", capabilities: [], adapterData: {} });
    const command = vi.fn(async commandInput => registry.get(commandInput.deviceId)!);
    const engine = new AutomationEngine(registry as never, { command }, memoryStore());
    await engine.start();
    await engine.create({ name: "Virtual target", enabled: true, triggerDeviceId: "trigger", triggerStateKey: "motion", triggerValue: true, actionDeviceId: "virtual-target", action: "turnOn" });
    registry.publish(device("trigger", { motion: true }));
    await tick();
    await tick();
    expect(command).toHaveBeenCalledWith({ deviceId: "virtual-target", capability: "turnOn", source: "automation" });
    engine.stop();
  });

  it("supports OpenCCU covers and thermostat modes as target actions", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { motion: false }));
    registry.devices.set("cover", { ...device("cover", { currentPosition: 0, targetPosition: 0 }, ["open", "close", "setTargetPosition"]), source: "openccu", type: "windowCovering" });
    registry.devices.set("thermostat", { ...device("thermostat", { temperature: 20, targetTemperature: 20, controlMode: "off" }, ["setTargetTemperature", "setThermostatMode"]), source: "openccu", type: "thermostat" });
    const command = vi.fn(async commandInput => registry.get(commandInput.deviceId)!);
    const engine = new AutomationEngine(registry as never, { command }, memoryStore());
    await engine.start();
    await engine.create({
      name: "OpenCCU targets", enabled: true, triggerDeviceId: "trigger", triggerStateKey: "motion", triggerValue: true,
      actionDeviceId: "cover", action: "open", additionalActions: [{ deviceId: "thermostat", action: "thermostatAuto" }]
    });
    registry.publish(device("trigger", { motion: true }));
    await tick();
    await tick();
    expect(command.mock.calls.map(call => call[0])).toEqual([
      { deviceId: "cover", capability: "open", source: "automation" },
      { deviceId: "thermostat", capability: "setThermostatMode", value: "auto", source: "automation" }
    ]);
    engine.stop();
  });

  it("sets thermostat target temperatures for primary and additional target actions", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { motion: false }));
    registry.devices.set("thermostat-a", {
      ...device("thermostat-a", { temperature: 20, targetTemperature: 20, controlMode: "manual" }, ["setTargetTemperature", "setThermostatMode"]),
      source: "openccu",
      type: "thermostat",
      adapterData: { targetTemperatureMin: 4.5, targetTemperatureMax: 30, targetTemperatureStep: 0.5 }
    });
    registry.devices.set("thermostat-b", {
      ...device("thermostat-b", { temperature: 21, targetTemperature: 21, controlMode: "auto" }, ["setTargetTemperature", "setThermostatMode"]),
      source: "openccu",
      type: "thermostat",
      adapterData: { targetTemperatureMin: 5, targetTemperatureMax: 28, targetTemperatureStep: 0.5 }
    });
    const command = vi.fn(async commandInput => registry.get(commandInput.deviceId)!);
    const engine = new AutomationEngine(registry as never, { command }, memoryStore());
    await engine.start();
    await engine.create({
      name: "Heat rooms", enabled: true,
      triggerDeviceId: "trigger", triggerStateKey: "motion", triggerValue: true,
      actionDeviceId: "thermostat-a", action: "setTargetTemperature", actionValue: 22.5,
      additionalActions: [{ deviceId: "thermostat-b", action: "setTargetTemperature", value: 19.5 }]
    });

    registry.publish(device("trigger", { motion: true }));
    await tick();
    await tick();
    expect(command.mock.calls.map(call => call[0])).toEqual([
      { deviceId: "thermostat-a", capability: "setTargetTemperature", value: 22.5, source: "automation" },
      { deviceId: "thermostat-b", capability: "setTargetTemperature", value: 19.5, source: "automation" }
    ]);
    engine.stop();
  });

  it("rejects thermostat target temperatures outside the device range", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { motion: false }));
    registry.devices.set("thermostat", {
      ...device("thermostat", { targetTemperature: 20, controlMode: "manual" }, ["setTargetTemperature", "setThermostatMode"]),
      source: "openccu",
      type: "thermostat",
      adapterData: { targetTemperatureMin: 5, targetTemperatureMax: 28 }
    });
    const engine = new AutomationEngine(registry as never, { command: vi.fn(async commandInput => registry.get(commandInput.deviceId)!) }, memoryStore());
    await engine.start();
    await expect(engine.create({
      name: "Invalid heat", enabled: true,
      triggerDeviceId: "trigger", triggerStateKey: "motion", triggerValue: true,
      actionDeviceId: "thermostat", action: "setTargetTemperature", actionValue: 31
    })).rejects.toThrow("AUTOMATION_ACTION_TEMPERATURE_INVALID");
    engine.stop();
  });

  it("includes additional target devices in cycle protection", async () => {
    const registry = new TestRegistry();
    for (const id of ["a", "b", "c"]) registry.devices.set(id, device(id, { on: false }, ["turnOn", "turnOff", "toggle"]));
    const engine = new AutomationEngine(registry as never, { command: vi.fn(async commandInput => registry.get(commandInput.deviceId)!) }, memoryStore());
    await engine.start();
    await engine.create({
      name: "A to B and C", enabled: true, triggerDeviceId: "a", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "b", action: "turnOn", additionalActions: [{ deviceId: "c", action: "turnOn" }]
    });
    await expect(engine.create({
      name: "C to A", enabled: true, triggerDeviceId: "c", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "a", action: "turnOn"
    })).rejects.toThrow("AUTOMATION_CYCLE_NOT_ALLOWED");
    engine.stop();
  });

});
