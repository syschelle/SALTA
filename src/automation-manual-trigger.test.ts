import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { AutomationEngine, type AutomationInput, type AutomationRule, type AutomationStore } from "./automations.js";
import type { Device, DeviceState } from "./types.js";

function device(id: string, state: DeviceState, capabilities: string[] = []): Device {
  return {
    id, source: "virtual", sourceId: id, type: capabilities.length ? "switch" : "motionSensor", name: id,
    reachable: true, state, capabilities, homekitEnabled: false, hidden: false, credentialMode: "none", passwordConfigured: false,
    lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString()
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
      const timestamp = new Date().toISOString();
      const rule: AutomationRule = { id: `rule-${rules.length + 1}`, ...input, createdAt: timestamp, updatedAt: timestamp };
      rules.push(rule);
      return rule;
    }),
    update: vi.fn(async (id: string, input: AutomationInput) => {
      const index = rules.findIndex(rule => rule.id === id);
      if (index < 0) return undefined;
      const next: AutomationRule = { ...rules[index]!, ...input, updatedAt: new Date().toISOString() };
      rules[index] = next;
      return next;
    }),
    remove: vi.fn(async () => true),
    markTriggered: vi.fn(async () => undefined)
  };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe("manual automation trigger", () => {
  it("runs the configured actions without evaluating When, execution days or Only-if conditions", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("condition", device("condition", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const command = vi.fn(async () => registry.get("target")!);
    const now = new Date("2026-08-22T12:00:00.000Z"); // Saturday in Europe/Berlin
    const engine = new AutomationEngine(registry as never, { command }, memoryStore(), undefined, { now: () => now, timeZone: "Europe/Berlin" });
    await engine.start();
    const rule = await engine.create({
      name: "Manual test", enabled: true, executionDays: [1],
      triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      conditionDeviceId: "condition", conditionStateKey: "on", conditionValue: true,
      actionDeviceId: "target", action: "turnOn"
    });

    registry.publish(device("trigger", { on: true }, ["turnOn", "turnOff", "toggle"]));
    await tick();
    expect(command).not.toHaveBeenCalled();

    await engine.triggerManually(rule.id);
    expect(command).toHaveBeenCalledTimes(1);

    await engine.setEnabled(rule.id, false);
    await engine.triggerManually(rule.id);
    expect(command).toHaveBeenCalledTimes(2);
    engine.stop();
  });

  it("rejects an unknown automation id before queueing manual execution", async () => {
    const registry = new TestRegistry();
    const engine = new AutomationEngine(registry as never, { command: vi.fn() }, memoryStore());
    await engine.start();
    expect(() => engine.triggerManually("missing")).toThrow("AUTOMATION_NOT_FOUND");
    engine.stop();
  });
});
