import type { Device, DeviceCommand, DeviceEvent, DeviceState } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

export type AutomationAction = "turnOn" | "turnOff" | "toggle";

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  roomId?: string;
  triggerDeviceId: string;
  triggerStateKey: string;
  triggerValue: boolean;
  conditionDeviceId?: string;
  conditionStateKey?: string;
  conditionValue?: boolean;
  actionDeviceId: string;
  action: AutomationAction;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationInput {
  name: string;
  enabled: boolean;
  roomId?: string;
  triggerDeviceId: string;
  triggerStateKey: string;
  triggerValue: boolean;
  conditionDeviceId?: string;
  conditionStateKey?: string;
  conditionValue?: boolean;
  actionDeviceId: string;
  action: AutomationAction;
}

export interface AutomationStore {
  list(): Promise<AutomationRule[]>;
  create(input: AutomationInput): Promise<AutomationRule>;
  update(id: string, input: AutomationInput): Promise<AutomationRule | undefined>;
  remove(id: string): Promise<boolean>;
  markTriggered(id: string, at: string): Promise<void>;
}

export interface AutomationLogger {
  write(
    level: "info" | "warning" | "error",
    source: string,
    code: string | undefined,
    message: string,
    details?: Record<string, unknown>
  ): Promise<void>;
}

export interface AutomationEventTrigger {
  key: string;
  value: number;
}

const eventTriggerPrefix = "event:";
const noOpLogger: AutomationLogger = {
  async write(): Promise<void> {
    // Core automation logic is infrastructure-independent by default.
  }
};

const preferredBooleanKeys = ["on", "motion", "open", "water", "fire", "alarm", "vibration", "dark", "daylight", "tampered", "lowBattery"];

export function booleanStateKeys(device: Device): string[] {
  const keys = Object.entries(device.state)
    .filter(([, value]) => typeof value === "boolean")
    .map(([key]) => key);
  return [...keys].sort((left, right) => {
    const leftIndex = preferredBooleanKeys.indexOf(left);
    const rightIndex = preferredBooleanKeys.indexOf(right);
    if (leftIndex >= 0 || rightIndex >= 0) {
      if (leftIndex < 0) return 1;
      if (rightIndex < 0) return -1;
      return leftIndex - rightIndex;
    }
    return left.localeCompare(right);
  });
}

export function eventStateKeys(device: Device): string[] {
  const keys: string[] = [];
  if (device.type === "button" || typeof device.state.buttonEvent === "number" || device.adapterData?.buttonEventProtocol === "deconz") {
    keys.push("buttonEvent");
  }
  return keys;
}

export function encodeAutomationEventTrigger(key: string, value: number): string {
  const normalizedKey = key.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(normalizedKey) || !Number.isSafeInteger(value)) {
    throw new Error("AUTOMATION_EVENT_TRIGGER_INVALID");
  }
  return `${eventTriggerPrefix}${normalizedKey}:${value}`;
}

export function parseAutomationEventTrigger(value: string): AutomationEventTrigger | undefined {
  const match = /^event:([a-zA-Z][a-zA-Z0-9_-]{0,63}):(-?\d+)$/.exec(value.trim());
  if (!match?.[1] || match[2] === undefined) return undefined;
  const eventValue = Number(match[2]);
  if (!Number.isSafeInteger(eventValue)) return undefined;
  return { key: match[1], value: eventValue };
}

function booleanState(state: DeviceState, key: string): boolean | undefined {
  const value = state[key];
  return typeof value === "boolean" ? value : undefined;
}

function actionCapabilitySupported(device: Device, action: AutomationAction): boolean {
  return device.capabilities.includes(action);
}

function cloneInput(input: AutomationInput): AutomationInput {
  return {
    ...input,
    name: input.name.trim(),
    triggerStateKey: input.triggerStateKey.trim(),
    conditionStateKey: input.conditionStateKey?.trim() || undefined
  };
}

function assertAcyclic(rules: AutomationRule[], candidate: AutomationRule): void {
  const active = [...rules.filter(rule => rule.id !== candidate.id && rule.enabled), ...(candidate.enabled ? [candidate] : [])];
  const graph = new Map<string, string[]>();
  for (const rule of active) {
    const targets = graph.get(rule.triggerDeviceId) ?? [];
    targets.push(rule.actionDeviceId);
    graph.set(rule.triggerDeviceId, targets);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (deviceId: string): boolean => {
    if (visiting.has(deviceId)) return true;
    if (visited.has(deviceId)) return false;
    visiting.add(deviceId);
    for (const target of graph.get(deviceId) ?? []) {
      if (walk(target)) return true;
    }
    visiting.delete(deviceId);
    visited.add(deviceId);
    return false;
  };

  for (const deviceId of graph.keys()) {
    if (walk(deviceId)) throw new Error("AUTOMATION_CYCLE_NOT_ALLOWED");
  }
}

export class AutomationEngine {
  private rules: AutomationRule[] = [];
  private readonly snapshots = new Map<string, DeviceState>();
  private readonly executionQueues = new Map<string, Promise<void>>();
  private started = false;
  private readonly onDevice = (device: Device): void => {
    void this.handleDevice(device).catch(error => {
      void this.logger.write("error", "automation", "AUTOMATION_ENGINE_ERROR", "Automation engine failed while processing a device update", {
        deviceId: device.id,
        error: error instanceof Error ? error.message : String(error)
      }).catch(() => undefined);
    });
  };

  private readonly onDeviceEvent = (event: DeviceEvent): void => {
    this.handleDeviceEvent(event);
  };

  private readonly onDeviceRemoved = (device: Device): void => {
    this.snapshots.delete(device.id);
    this.rules = this.rules.filter(rule =>
      rule.triggerDeviceId !== device.id
      && rule.conditionDeviceId !== device.id
      && rule.actionDeviceId !== device.id
    );
  };

  constructor(
    private readonly registry: DeviceRegistry,
    private readonly commander: { command(command: DeviceCommand): Promise<Device> },
    private readonly store: AutomationStore,
    private readonly logger: AutomationLogger = noOpLogger
  ) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.rules = await this.store.list();
    this.snapshots.clear();
    for (const device of this.registry.all()) this.snapshots.set(device.id, { ...device.state });
    this.registry.on("device", this.onDevice);
    this.registry.on("deviceEvent", this.onDeviceEvent);
    this.registry.on("deviceRemoved", this.onDeviceRemoved);
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    this.registry.off("device", this.onDevice);
    this.registry.off("deviceEvent", this.onDeviceEvent);
    this.registry.off("deviceRemoved", this.onDeviceRemoved);
    this.executionQueues.clear();
    this.started = false;
  }

  list(): AutomationRule[] {
    return [...this.rules].sort((a, b) => a.name.localeCompare(b.name));
  }

  private assertValidInput(input: AutomationInput, currentId?: string): void {
    if (!input.name.trim()) throw new Error("AUTOMATION_NAME_REQUIRED");
    const trigger = this.registry.get(input.triggerDeviceId);
    if (!trigger) throw new Error("AUTOMATION_TRIGGER_DEVICE_NOT_FOUND");
    const eventTrigger = parseAutomationEventTrigger(input.triggerStateKey);
    if (eventTrigger) {
      if (!eventStateKeys(trigger).includes(eventTrigger.key)) throw new Error("AUTOMATION_TRIGGER_EVENT_UNSUPPORTED");
    } else if (!booleanStateKeys(trigger).includes(input.triggerStateKey)) {
      throw new Error("AUTOMATION_TRIGGER_STATE_UNSUPPORTED");
    }

    const target = this.registry.get(input.actionDeviceId);
    if (!target) throw new Error("AUTOMATION_ACTION_DEVICE_NOT_FOUND");
    if (input.triggerDeviceId === input.actionDeviceId) throw new Error("AUTOMATION_TRIGGER_ACTION_SAME_DEVICE");
    if (!actionCapabilitySupported(target, input.action)) throw new Error("AUTOMATION_ACTION_UNSUPPORTED");

    const hasCondition = Boolean(input.conditionDeviceId);
    if (hasCondition) {
      if (input.conditionDeviceId === input.triggerDeviceId) throw new Error("AUTOMATION_CONDITION_TRIGGER_SAME_DEVICE");
      const condition = this.registry.get(input.conditionDeviceId!);
      if (!condition) throw new Error("AUTOMATION_CONDITION_DEVICE_NOT_FOUND");
      if (!input.conditionStateKey || typeof input.conditionValue !== "boolean") throw new Error("AUTOMATION_CONDITION_INVALID");
      if (!booleanStateKeys(condition).includes(input.conditionStateKey)) throw new Error("AUTOMATION_CONDITION_STATE_UNSUPPORTED");
    } else if (input.conditionStateKey !== undefined || input.conditionValue !== undefined) {
      throw new Error("AUTOMATION_CONDITION_INVALID");
    }

    const createdAt = new Date().toISOString();
    const candidate: AutomationRule = {
      id: currentId ?? "candidate",
      ...cloneInput(input),
      createdAt,
      updatedAt: createdAt
    };
    assertAcyclic(this.rules, candidate);
  }

  async create(input: AutomationInput): Promise<AutomationRule> {
    const normalized = cloneInput(input);
    this.assertValidInput(normalized);
    const rule = await this.store.create(normalized);
    this.rules = [...this.rules, rule];
    return rule;
  }

  async update(id: string, input: AutomationInput): Promise<AutomationRule> {
    if (!this.rules.some(rule => rule.id === id)) throw new Error("AUTOMATION_NOT_FOUND");
    const normalized = cloneInput(input);
    this.assertValidInput(normalized, id);
    const updated = await this.store.update(id, normalized);
    if (!updated) throw new Error("AUTOMATION_NOT_FOUND");
    this.rules = this.rules.map(rule => rule.id === id ? updated : rule);
    return updated;
  }

  async setEnabled(id: string, enabled: boolean): Promise<AutomationRule> {
    const current = this.rules.find(rule => rule.id === id);
    if (!current) throw new Error("AUTOMATION_NOT_FOUND");
    return this.update(id, {
      name: current.name,
      enabled,
      roomId: current.roomId,
      triggerDeviceId: current.triggerDeviceId,
      triggerStateKey: current.triggerStateKey,
      triggerValue: current.triggerValue,
      conditionDeviceId: current.conditionDeviceId,
      conditionStateKey: current.conditionStateKey,
      conditionValue: current.conditionValue,
      actionDeviceId: current.actionDeviceId,
      action: current.action
    });
  }

  clearRoomAssignment(roomId: string): void {
    this.rules = this.rules.map(rule => rule.roomId === roomId ? { ...rule, roomId: undefined } : rule);
  }

  async remove(id: string): Promise<void> {
    if (!await this.store.remove(id)) throw new Error("AUTOMATION_NOT_FOUND");
    this.rules = this.rules.filter(rule => rule.id !== id);
    this.executionQueues.delete(id);
  }

  private conditionAllows(rule: AutomationRule): boolean {
    if (!rule.conditionDeviceId) return true;
    const conditionDevice = this.registry.get(rule.conditionDeviceId);
    if (!conditionDevice || !conditionDevice.reachable) return false;
    return booleanState(conditionDevice.state, rule.conditionStateKey!) === rule.conditionValue;
  }

  private queueRule(rule: AutomationRule, trigger: Record<string, unknown>): void {
    const previous = this.executionQueues.get(rule.id) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.executeRule(rule.id, trigger));
    this.executionQueues.set(rule.id, next);
    void next.finally(() => {
      if (this.executionQueues.get(rule.id) === next) this.executionQueues.delete(rule.id);
    });
  }

  private async executeRule(ruleId: string, trigger: Record<string, unknown>): Promise<void> {
    const rule = this.rules.find(item => item.id === ruleId);
    if (!rule?.enabled || !this.conditionAllows(rule)) return;
    const target = this.registry.get(rule.actionDeviceId);
    if (!target || !target.reachable || !actionCapabilitySupported(target, rule.action)) return;

    try {
      await this.commander.command({
        deviceId: rule.actionDeviceId,
        capability: rule.action,
        source: "automation"
      });
      const triggeredAt = new Date().toISOString();
      await this.store.markTriggered(rule.id, triggeredAt);
      this.rules = this.rules.map(item => item.id === rule.id ? { ...item, lastTriggeredAt: triggeredAt } : item);
      await this.logger.write("info", "automation", "AUTOMATION_TRIGGERED", "Automation executed", {
        automationId: rule.id,
        automationName: rule.name,
        triggerDeviceId: rule.triggerDeviceId,
        actionDeviceId: rule.actionDeviceId,
        action: rule.action,
        ...trigger
      }).catch(() => undefined);
    } catch (error) {
      await this.logger.write("error", "automation", "AUTOMATION_ACTION_FAILED", "Automation action failed", {
        automationId: rule.id,
        automationName: rule.name,
        actionDeviceId: rule.actionDeviceId,
        action: rule.action,
        error: error instanceof Error ? error.message : String(error),
        ...trigger
      }).catch(() => undefined);
    }
  }

  private async handleDevice(device: Device): Promise<void> {
    const previous = this.snapshots.get(device.id);
    this.snapshots.set(device.id, { ...device.state });
    if (!previous) return;

    for (const rule of this.rules) {
      if (!rule.enabled || rule.triggerDeviceId !== device.id || parseAutomationEventTrigger(rule.triggerStateKey)) continue;
      const before = booleanState(previous, rule.triggerStateKey);
      const current = booleanState(device.state, rule.triggerStateKey);
      if (current === undefined || current !== rule.triggerValue || before === current) continue;
      this.queueRule(rule, { triggerType: "state", triggerStateKey: rule.triggerStateKey, triggerValue: current });
    }
  }

  private handleDeviceEvent(event: DeviceEvent): void {
    for (const rule of this.rules) {
      if (!rule.enabled || rule.triggerDeviceId !== event.deviceId) continue;
      const eventTrigger = parseAutomationEventTrigger(rule.triggerStateKey);
      if (!eventTrigger || eventTrigger.key !== event.key || eventTrigger.value !== event.value) continue;
      this.queueRule(rule, {
        triggerType: "event",
        triggerEventKey: event.key,
        triggerEventValue: event.value,
        triggerReceivedAt: event.receivedAt
      });
    }
  }
}
