from pathlib import Path

automations = Path("src/automations.ts")
text = automations.read_text()
old = '''  async setEnabled(id: string, enabled: boolean): Promise<AutomationRule> {
    const current = this.rules.find(rule => rule.id === id);
    if (!current) throw new Error("AUTOMATION_NOT_FOUND");
    return this.update(id, {
      name: current.name,
      enabled,
      roomId: current.roomId,
      triggerType: current.triggerType,
      triggerTime: current.triggerTime,
      executionDays: current.executionDays,
      triggerDeviceId: current.triggerDeviceId,
      triggerStateKey: current.triggerStateKey,
      triggerValue: current.triggerValue,
      additionalTriggers: current.additionalTriggers,
      conditionDeviceId: current.conditionDeviceId,
      conditionStateKey: current.conditionStateKey,
      conditionValue: current.conditionValue,
      additionalConditions: current.additionalConditions,
      actionDeviceId: current.actionDeviceId,
      action: current.action,
      actionValue: current.actionValue,
      additionalActions: current.additionalActions,
      sequence: current.sequence
    });
  }
'''
new = '''  private inputFromRule(rule: AutomationRule, overrides: Partial<AutomationInput> = {}): AutomationInput {
    return {
      name: rule.name,
      enabled: rule.enabled,
      roomId: rule.roomId,
      triggerType: rule.triggerType,
      triggerTime: rule.triggerTime,
      executionDays: rule.executionDays,
      triggerDeviceId: rule.triggerDeviceId,
      triggerStateKey: rule.triggerStateKey,
      triggerValue: rule.triggerValue,
      additionalTriggers: rule.additionalTriggers,
      conditionDeviceId: rule.conditionDeviceId,
      conditionStateKey: rule.conditionStateKey,
      conditionValue: rule.conditionValue,
      additionalConditions: rule.additionalConditions,
      actionDeviceId: rule.actionDeviceId,
      action: rule.action,
      actionValue: rule.actionValue,
      additionalActions: rule.additionalActions,
      sequence: rule.sequence,
      ...overrides
    };
  }

  async setEnabled(id: string, enabled: boolean): Promise<AutomationRule> {
    const current = this.rules.find(rule => rule.id === id);
    if (!current) throw new Error("AUTOMATION_NOT_FOUND");
    return this.update(id, this.inputFromRule(current, { enabled }));
  }

  async duplicate(id: string): Promise<AutomationRule> {
    const current = this.rules.find(rule => rule.id === id);
    if (!current) throw new Error("AUTOMATION_NOT_FOUND");
    const existingNames = new Set(this.rules.map(rule => rule.name));
    let copyName = "";
    for (let index = 1; index <= 999; index += 1) {
      const suffix = index === 1 ? " (Kopie)" : ` (Kopie ${index})`;
      const base = current.name.slice(0, Math.max(1, 120 - suffix.length)).trimEnd();
      const candidate = `${base}${suffix}`;
      if (!existingNames.has(candidate)) {
        copyName = candidate;
        break;
      }
    }
    if (!copyName) throw new Error("AUTOMATION_DUPLICATE_NAME_UNAVAILABLE");
    return this.create(this.inputFromRule(current, { name: copyName, enabled: false }));
  }

  async triggerManually(id: string): Promise<AutomationRule> {
    const current = this.rules.find(rule => rule.id === id);
    if (!current) throw new Error("AUTOMATION_NOT_FOUND");
    if (!current.enabled) throw new Error("AUTOMATION_DISABLED");
    if (!this.conditionAllows(current)) throw new Error("AUTOMATION_CONDITION_NOT_MET");
    this.queueRule(current, { triggerType: "manual", triggerSource: "ui" }, { bypassExecutionDay: true });
    await this.logger.write("info", "automation", "AUTOMATION_MANUAL_TRIGGER_QUEUED", "Automation queued by manual trigger", {
      automationId: current.id, automationName: current.name
    }).catch(() => undefined);
    return current;
  }
'''
if old not in text:
    raise SystemExit("automations setEnabled anchor not found")
text = text.replace(old, new, 1)
old_queue = '''  private queueRule(rule: AutomationRule, trigger: Record<string, unknown>): void {
    if (!this.executionDayAllows(rule)) return;
'''
new_queue = '''  private queueRule(rule: AutomationRule, trigger: Record<string, unknown>, options: { bypassExecutionDay?: boolean } = {}): void {
    if (!options.bypassExecutionDay) {
      if (!this.executionDayAllows(rule)) return;
    }
'''
if old_queue not in text:
    raise SystemExit("automations queue anchor not found")
automations.write_text(text.replace(old_queue, new_queue, 1))

server = Path("src/server.ts")
text = server.read_text()
old_messages = '''    AUTOMATION_CONDITION_DUPLICATE: "The same condition is configured more than once.",
    AUTOMATION_ACTION_TEMPERATURE_INVALID: "The selected thermostat target temperature is outside the supported device range.",
'''
new_messages = '''    AUTOMATION_CONDITION_DUPLICATE: "The same condition is configured more than once.",
    AUTOMATION_CONDITION_NOT_MET: "The automation's 'Only if' condition is currently not met.",
    AUTOMATION_DISABLED: "The automation is disabled and cannot be triggered manually.",
    AUTOMATION_DUPLICATE_NAME_UNAVAILABLE: "A unique name for the duplicated automation could not be created.",
    AUTOMATION_ACTION_TEMPERATURE_INVALID: "The selected thermostat target temperature is outside the supported device range.",
'''
if old_messages not in text:
    raise SystemExit("server automation error anchor not found")
text = text.replace(old_messages, new_messages, 1)
old_return = '''  return { status: code === "AUTOMATION_NOT_FOUND" ? 404 : code.endsWith("_NOT_FOUND") ? 404 : 400, code, message: messages[code] ?? "The automation could not be saved." };
'''
new_return = '''  const status = code === "AUTOMATION_NOT_FOUND" || code.endsWith("_NOT_FOUND") ? 404
    : ["AUTOMATION_DISABLED", "AUTOMATION_CONDITION_NOT_MET"].includes(code) ? 409
    : 400;
  return { status, code, message: messages[code] ?? "The automation request could not be completed." };
'''
if old_return not in text:
    raise SystemExit("server automation error return anchor not found")
text = text.replace(old_return, new_return, 1)
route_anchor = '''  app.patch<{ Params: { id: string }; Body: unknown }>("/api/automations/:id/enabled", {
'''
routes = '''  app.post<{ Params: { id: string } }>("/api/automations/:id/trigger", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "automations-trigger" } }
  }, async (request, reply) => {
    if (!automationEngine) return reply.code(503).send({ error: { code: "AUTOMATION_ENGINE_UNAVAILABLE", message: "Automations are not available.", requestId: request.id } });
    try {
      const automation = await automationEngine.triggerManually(request.params.id);
      return reply.code(202).send({ status: "queued", automationId: automation.id, automationName: automation.name });
    } catch (error) {
      const response = automationError(error);
      return reply.code(response.status).send({ error: { code: response.code, message: response.message, requestId: request.id } });
    }
  });
  app.post<{ Params: { id: string } }>("/api/automations/:id/duplicate", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "automations-duplicate" } }
  }, async (request, reply) => {
    if (!automationEngine) return reply.code(503).send({ error: { code: "AUTOMATION_ENGINE_UNAVAILABLE", message: "Automations are not available.", requestId: request.id } });
    try {
      const automation = await automationEngine.duplicate(request.params.id);
      await writeSystemLog("info", "automation", "AUTOMATION_DUPLICATED", "Automation duplicated", { automationId: automation.id, automationName: automation.name, sourceAutomationId: request.params.id }).catch(() => undefined);
      return reply.code(201).send(automation);
    } catch (error) {
      const response = automationError(error);
      return reply.code(response.status).send({ error: { code: response.code, message: response.message, requestId: request.id } });
    }
  });
'''
if route_anchor not in text:
    raise SystemExit("server automation route anchor not found")
server.write_text(text.replace(route_anchor, routes + route_anchor, 1))

Path("src/automation-v08113-regression.test.ts").write_text('''import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AutomationEngine, type AutomationInput, type AutomationRule, type AutomationStore } from "./automations.js";
import type { Device, DeviceState } from "./types.js";

function device(id: string, state: DeviceState): Device {
  return { id, source: "virtual", sourceId: id, type: "switch", name: id, reachable: true, state,
    capabilities: ["turnOn", "turnOff", "toggle"], homekitEnabled: false, hidden: false,
    credentialMode: "none", passwordConfigured: false, lastSeen: new Date().toISOString(), lastEvent: new Date().toISOString() };
}
class Registry extends EventEmitter {
  devices = new Map<string, Device>();
  all(): Device[] { return [...this.devices.values()]; }
  get(id: string): Device | undefined { return this.devices.get(id); }
}
function store(): AutomationStore {
  const rules: AutomationRule[] = [];
  return {
    list: vi.fn(async () => [...rules]),
    create: vi.fn(async (input: AutomationInput) => { const now = new Date().toISOString(); const rule = { id: `rule-${rules.length + 1}`, ...input, createdAt: now, updatedAt: now }; rules.push(rule); return rule; }),
    update: vi.fn(async () => undefined), remove: vi.fn(async () => false), markTriggered: vi.fn(async () => undefined)
  };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe("v0.8.113 automation controls regression", () => {
  it("manually runs without WENN or weekday matching but keeps Nur-wenn active", async () => {
    const registry = new Registry();
    registry.devices.set("trigger", device("trigger", { on: false }));
    registry.devices.set("guard", device("guard", { on: true }));
    registry.devices.set("target", device("target", { on: false }));
    const command = vi.fn(async () => registry.get("target")!);
    const engine = new AutomationEngine(registry as never, { command }, store(), undefined, { now: () => new Date("2026-10-12T12:00:00Z"), timeZone: "UTC" });
    await engine.start();
    const rule = await engine.create({ name: "Manual", enabled: true, executionDays: [2], triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true, conditionDeviceId: "guard", conditionStateKey: "on", conditionValue: true, actionDeviceId: "target", action: "turnOn" });
    await engine.triggerManually(rule.id); await tick(); await tick();
    expect(command).toHaveBeenCalledTimes(1);
    registry.devices.set("guard", device("guard", { on: false }));
    await expect(engine.triggerManually(rule.id)).rejects.toThrow("AUTOMATION_CONDITION_NOT_MET");
    engine.stop();
  });

  it("creates disabled full copies with unique names", async () => {
    const registry = new Registry();
    registry.devices.set("trigger", device("trigger", { on: false })); registry.devices.set("target", device("target", { on: false }));
    const engine = new AutomationEngine(registry as never, { command: vi.fn(async () => registry.get("target")!) }, store());
    await engine.start();
    const original = await engine.create({ name: "Rule", enabled: true, triggerDeviceId: "trigger", triggerStateKey: "on", triggerValue: true, actionDeviceId: "target", action: "turnOn", sequence: [{ deviceId: "target", action: "turnOn" }, { action: "wait", value: 5 }, { deviceId: "target", action: "turnOff" }] });
    const first = await engine.duplicate(original.id); const second = await engine.duplicate(original.id);
    expect(first).toMatchObject({ name: "Rule (Kopie)", enabled: false, sequence: original.sequence });
    expect(second).toMatchObject({ name: "Rule (Kopie 2)", enabled: false });
    engine.stop();
  });

  it("exposes dedicated manual-trigger and duplicate API routes", () => {
    const server = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
    expect(server).toContain('/api/automations/:id/trigger');
    expect(server).toContain('/api/automations/:id/duplicate');
  });
});
''')
