import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { AutomationEngine, type AutomationInput, type AutomationRule, type AutomationStore } from "./automations.js";
import type { Device } from "./types.js";

class TestRegistry extends EventEmitter {
  devices = new Map<string, Device>();
  all(): Device[] { return [...this.devices.values()]; }
  get(id: string): Device | undefined { return this.devices.get(id); }
}

function target(id: string): Device {
  return { id, source: "openccu", sourceId: id, type: "thermostat", name: id, model: "HM-TC-IT-WM-W-EU", reachable: true,
    state: { targetTemperature: 20, controlMode: "manual" }, capabilities: ["setTargetTemperature"], homekitEnabled: false, hidden: false,
    credentialMode: "none", passwordConfigured: false, lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString() };
}

function triggerDevice(): Device {
  return { id: "trigger", source: "virtual", sourceId: "trigger", type: "motionSensor", name: "trigger", reachable: true,
    state: { on: false }, capabilities: [], homekitEnabled: false, hidden: false,
    credentialMode: "none", passwordConfigured: false, lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString() };
}

function store(): AutomationStore {
  const rules: AutomationRule[] = [];
  return {
    list: vi.fn(async () => [...rules]),
    create: vi.fn(async (input: AutomationInput) => { const at = new Date().toISOString(); const rule: AutomationRule = { id: "diag-rule", ...input, createdAt: at, updatedAt: at }; rules.push(rule); return rule; }),
    update: vi.fn(async () => undefined), remove: vi.fn(async () => true), markTriggered: vi.fn(async () => undefined)
  };
}

describe("automation execution diagnostics", () => {
  it("logs the complete loaded sequence at start and finish for a manual run", async () => {
    const registry = new TestRegistry();
    registry.devices.set("trigger", triggerDevice());
    for (const id of ["t1", "t2", "t3", "t4"]) registry.devices.set(id, target(id));
    const command = vi.fn(async (request: { deviceId: string }) => registry.get(request.deviceId)!);
    const entries: Array<{ code?: string; details?: Record<string, unknown> }> = [];
    const logger = { write: vi.fn(async (_level: string, _source: string, code: string | undefined, _message: string, details?: Record<string, unknown>) => { entries.push({ code, details }); }) };
    const engine = new AutomationEngine(registry as never, { command } as never, store(), logger as never);
    await engine.start();
    const rule = await engine.create({ name: "Night setback", enabled: true, triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true,
      actionDeviceId: "t1", action: "setTargetTemperature", actionValue: 15,
      sequence: ["t1", "t2", "t3", "t4"].map(deviceId => ({ deviceId, action: "setTargetTemperature" as const, value: 15 })) });
    await engine.triggerManually(rule.id);
    const started = entries.find(entry => entry.code === "AUTOMATION_EXECUTION_STARTED");
    const finished = entries.find(entry => entry.code === "AUTOMATION_EXECUTION_FINISHED");
    expect((started?.details?.steps as unknown[])).toHaveLength(4);
    expect((started?.details?.steps as Array<{ deviceId: string }>).map(step => step.deviceId)).toEqual(["t1", "t2", "t3", "t4"]);
    const executionId = String(started?.details?.executionId ?? "");
    expect(executionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(finished?.details?.executionId).toBe(executionId);
    expect(finished?.details?.successfulActions).toBe(4);
    expect(finished?.details?.failedActions).toBe(0);
    expect((finished?.details?.results as Array<{ step: number; status: string; deviceId: string }>)).toEqual([
      expect.objectContaining({ step: 1, status: "success", deviceId: "t1" }),
      expect.objectContaining({ step: 2, status: "success", deviceId: "t2" }),
      expect.objectContaining({ step: 3, status: "success", deviceId: "t3" }),
      expect.objectContaining({ step: 4, status: "success", deviceId: "t4" })
    ]);
    expect(command).toHaveBeenCalledTimes(4);
    for (const [index, call] of command.mock.calls.entries()) {
      expect(call[0]).toEqual(expect.objectContaining({
        source: "automation",
        diagnosticContext: expect.objectContaining({ executionId, automationId: rule.id, automationName: "Night setback", step: index + 1, sequenceLength: 4 })
      }));
    }
    const completed = entries.filter(entry => entry.code === "AUTOMATION_STEP_COMPLETED");
    expect(completed).toHaveLength(4);
    expect(completed.every(entry => entry.details?.executionId === executionId)).toBe(true);
    expect(completed.every(entry => entry.details?.localStateOrigin === "salta-local-registry-not-device-readback")).toBe(true);
    engine.stop();
  });
});
