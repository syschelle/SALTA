import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { AutomationEngine, localAutomationWeekday, type AutomationInput, type AutomationRule, type AutomationStore } from "./automations.js";
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
      rules.push(rule); return rule;
    }),
    update: vi.fn(async (id: string, input: AutomationInput) => {
      const index = rules.findIndex(rule => rule.id === id); if (index < 0) return undefined;
      const next: AutomationRule = { ...rules[index]!, ...input, updatedAt: new Date().toISOString() }; rules[index] = next; return next;
    }),
    remove: vi.fn(async () => true),
    markTriggered: vi.fn(async () => undefined)
  };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe("automation weekday restrictions", () => {
  it("calculates the weekday in the configured SALTA timezone", () => {
    expect(localAutomationWeekday(new Date("2026-08-22T12:00:00.000Z"), "Europe/Berlin")).toBe(6);
    expect(localAutomationWeekday(new Date("2026-08-24T12:00:00.000Z"), "Europe/Berlin")).toBe(1);
  });

  it("blocks device-triggered automations on unselected days and allows the next selected weekday", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const command = vi.fn(async () => registry.get("target")!);
    let now = new Date("2026-08-22T12:00:00.000Z"); // Saturday in Europe/Berlin
    const engine = new AutomationEngine(registry as never, { command }, memoryStore(), undefined, { now: () => now, timeZone: "Europe/Berlin" });
    await engine.start();
    await engine.create({
      name: "Weekdays only", enabled: true, executionDays: [1,2,3,4,5],
      triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "target", action: "toggle"
    });

    registry.publish(device("trigger", { on: true }, ["turnOn", "turnOff", "toggle"]));
    await tick();
    expect(command).not.toHaveBeenCalled();

    now = new Date("2026-08-24T12:00:00.000Z"); // Monday
    registry.publish(device("trigger", { on: false }, ["turnOn", "turnOff", "toggle"]));
    await tick();
    registry.publish(device("trigger", { on: true }, ["turnOn", "turnOff", "toggle"]));
    await tick();
    expect(command).toHaveBeenCalledTimes(1);
    engine.stop();
  });

  it("supports weekend-only execution and preserves all-days behavior when no restriction is supplied", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", device("trigger", { on: false }, ["turnOn", "turnOff", "toggle"]));
    registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
    const command = vi.fn(async () => registry.get("target")!);
    const now = new Date("2026-08-22T12:00:00.000Z");
    const store = memoryStore();
    const engine = new AutomationEngine(registry as never, { command }, store, undefined, { now: () => now, timeZone: "Europe/Berlin" });
    await engine.start();
    const weekend = await engine.create({
      name: "Weekend", enabled: true, executionDays: [6,7],
      triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "target", action: "toggle"
    });
    expect(weekend.executionDays).toEqual([6,7]);
    registry.publish(device("trigger", { on: true }, ["turnOn", "turnOff", "toggle"]));
    await tick();
    expect(command).toHaveBeenCalledTimes(1);

    const everyDay = await engine.create({
      name: "Every day", enabled: true,
      triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "target", action: "turnOn"
    });
    expect(everyDay.executionDays).toEqual([1,2,3,4,5,6,7]);
    engine.stop();
  });
  it("applies the same weekday restriction to daily time triggers", async () => {
    vi.useFakeTimers();
    try {
      const registry = new TestRegistry();
      registry.devices.set("target", device("target", { on: false }, ["turnOn", "turnOff", "toggle"]));
      const command = vi.fn(async () => registry.get("target")!);
      let now = new Date("2026-08-22T05:29:50.000Z"); // Saturday, 07:29:50 Europe/Berlin
      const engine = new AutomationEngine(registry as never, { command }, memoryStore(), undefined, { now: () => now, intervalMs: 1_000, timeZone: "Europe/Berlin" });
      await engine.start();
      await engine.create({
        name: "Weekday timer", enabled: true, executionDays: [1,2,3,4,5], triggerType: "time", triggerTime: "07:30",
        triggerDeviceId: "target", triggerStateKey: "__time__", triggerValue: true, actionDeviceId: "target", action: "turnOn"
      });

      now = new Date("2026-08-22T05:30:00.000Z");
      await vi.advanceTimersByTimeAsync(1_000);
      await Promise.resolve();
      expect(command).not.toHaveBeenCalled();

      now = new Date("2026-08-24T05:30:00.000Z"); // Monday, 07:30 Europe/Berlin
      await vi.advanceTimersByTimeAsync(1_000);
      await Promise.resolve();
      expect(command).toHaveBeenCalledTimes(1);
      engine.stop();
    } finally {
      vi.useRealTimers();
    }
  });

});
