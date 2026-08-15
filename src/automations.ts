import type { Device, DeviceCommand, DeviceEvent, DeviceState } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

export type AutomationAction = "turnOn" | "turnOff" | "toggle" | "open" | "close" | "thermostatOff" | "thermostatAuto" | "thermostatManual" | "setTargetTemperature";

export interface AutomationTargetAction {
  deviceId: string;
  action: AutomationAction;
  value?: number;
}

export interface AutomationTrigger {
  deviceId: string;
  stateKey: string;
  value: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  roomId?: string;
  triggerDeviceId: string;
  triggerStateKey: string;
  triggerValue: boolean;
  additionalTriggers?: AutomationTrigger[];
  conditionDeviceId?: string;
  conditionStateKey?: string;
  conditionValue?: boolean;
  actionDeviceId: string;
  action: AutomationAction;
  actionValue?: number;
  additionalActions?: AutomationTargetAction[];
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
  additionalTriggers?: AutomationTrigger[];
  conditionDeviceId?: string;
  conditionStateKey?: string;
  conditionValue?: boolean;
  actionDeviceId: string;
  action: AutomationAction;
  actionValue?: number;
  additionalActions?: AutomationTargetAction[];
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

function actionCommand(target: Pick<AutomationTargetAction, "action" | "value">): { capability: string; value?: string | number } {
  if (target.action === "thermostatOff") return { capability: "setThermostatMode", value: "off" };
  if (target.action === "thermostatAuto") return { capability: "setThermostatMode", value: "auto" };
  if (target.action === "thermostatManual") return { capability: "setThermostatMode", value: "manual" };
  if (target.action === "setTargetTemperature") return { capability: "setTargetTemperature", value: target.value };
  return { capability: target.action };
}

function thermostatTemperatureRange(device: Device): { min: number; max: number } {
  const metadata = device.adapterData ?? {};
  const min = Number(metadata.targetTemperatureMin ?? 4.5);
  const max = Number(metadata.targetTemperatureMax ?? 30);
  return {
    min: Number.isFinite(min) ? min : 4.5,
    max: Number.isFinite(max) ? max : 30
  };
}

function actionCapabilitySupported(device: Device, target: AutomationTargetAction): boolean {
  const action = target.action;
  const command = actionCommand(target);
  if (action === "setTargetTemperature") {
    if (!device.capabilities.includes("setTargetTemperature")) return false;
    const value = Number(target.value);
    const range = thermostatTemperatureRange(device);
    return Number.isFinite(value) && value >= range.min && value <= range.max;
  }
  if (device.capabilities.includes(command.capability)) return true;
  if (["turnOn", "turnOff", "toggle"].includes(action)) {
    // Virtual switches and momentary virtual buttons share the same binary command
    // contract. Keep legacy persisted virtual records executable as well.
    if (device.source === "virtual") return true;
    if (device.source === "openccu" && ["switch", "light", "outlet"].includes(device.type) && typeof device.state.on === "boolean") return true;
  }
  return command.capability === "setThermostatMode"
    && device.source === "openccu"
    && device.type === "thermostat"
    && device.capabilities.includes("setTargetTemperature")
    && typeof device.state.controlMode === "string";
}

function cloneInput(input: AutomationInput): AutomationInput {
  return {
    ...input,
    name: input.name.trim(),
    triggerStateKey: input.triggerStateKey.trim(),
    additionalTriggers: (input.additionalTriggers ?? []).map(trigger => ({
      deviceId: trigger.deviceId,
      stateKey: trigger.stateKey.trim(),
      value: trigger.value
    })),
    conditionStateKey: input.conditionStateKey?.trim() || undefined,
    actionValue: input.action === "setTargetTemperature" ? Number(input.actionValue) : undefined,
    additionalActions: (input.additionalActions ?? []).map(target => ({
      deviceId: target.deviceId,
      action: target.action,
      value: target.action === "setTargetTemperature" ? Number(target.value) : undefined
    }))
  };
}

export function automationRuleTriggers(rule: Pick<AutomationRule, "triggerDeviceId" | "triggerStateKey" | "triggerValue" | "additionalTriggers">): AutomationTrigger[] {
  return [
    { deviceId: rule.triggerDeviceId, stateKey: rule.triggerStateKey, value: rule.triggerValue },
    ...(rule.additionalTriggers ?? [])
  ];
}

export function automationRuleActions(rule: Pick<AutomationRule, "actionDeviceId" | "action" | "actionValue" | "additionalActions">): AutomationTargetAction[] {
  return [
    { deviceId: rule.actionDeviceId, action: rule.action, ...(rule.actionValue !== undefined ? { value: rule.actionValue } : {}) },
    ...(rule.additionalActions ?? [])
  ];
}

function triggerIdentity(trigger: AutomationTrigger): string {
  return `${trigger.deviceId}\u0000${trigger.stateKey}\u0000${trigger.value}`;
}

function virtualSelfResetAction(triggers: AutomationTrigger[], target: AutomationTargetAction, device: Device | undefined): boolean {
  if (!device || device.source !== "virtual" || device.adapterData?.virtualType === "button" || !["turnOn", "turnOff"].includes(target.action)) return false;
  const matchingTriggers = triggers.filter(trigger => trigger.deviceId === target.deviceId);
  if (matchingTriggers.length === 0) return false;
  if (matchingTriggers.some(trigger => parseAutomationEventTrigger(trigger.stateKey) || trigger.stateKey !== "on")) return false;
  const values = new Set(matchingTriggers.map(trigger => trigger.value));
  if (values.size !== 1) return false;
  const triggerValue = matchingTriggers[0]!.value;
  return triggerValue ? target.action === "turnOff" : target.action === "turnOn";
}

function assertAcyclic(rules: AutomationRule[], candidate: AutomationRule, registry: DeviceRegistry): void {
  const active = [...rules.filter(rule => rule.id !== candidate.id && rule.enabled), ...(candidate.enabled ? [candidate] : [])];
  const graph = new Map<string, string[]>();
  for (const rule of active) {
    const triggers = automationRuleTriggers(rule);
    const actions = automationRuleActions(rule);
    for (const trigger of triggers) {
      const targets = graph.get(trigger.deviceId) ?? [];
      targets.push(...actions
        .filter(action => !(action.deviceId === trigger.deviceId && virtualSelfResetAction(triggers, action, registry.get(action.deviceId))))
        .map(action => action.deviceId));
      graph.set(trigger.deviceId, targets);
    }
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
    this.rules = this.rules.flatMap(rule => {
      if (rule.triggerDeviceId === device.id || rule.conditionDeviceId === device.id || rule.actionDeviceId === device.id) return [];
      const additionalTriggers = (rule.additionalTriggers ?? []).filter(trigger => trigger.deviceId !== device.id);
      const additionalActions = (rule.additionalActions ?? []).filter(action => action.deviceId !== device.id);
      return [{ ...rule, additionalTriggers, additionalActions }];
    });
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
    const triggers = automationRuleTriggers({
      triggerDeviceId: input.triggerDeviceId,
      triggerStateKey: input.triggerStateKey,
      triggerValue: input.triggerValue,
      additionalTriggers: input.additionalTriggers
    });
    if (triggers.length > 8) throw new Error("AUTOMATION_TRIGGER_LIMIT");
    if (new Set(triggers.map(triggerIdentity)).size !== triggers.length) throw new Error("AUTOMATION_TRIGGER_DUPLICATE");

    for (const triggerInput of triggers) {
      const trigger = this.registry.get(triggerInput.deviceId);
      if (!trigger) throw new Error("AUTOMATION_TRIGGER_DEVICE_NOT_FOUND");
      const eventTrigger = parseAutomationEventTrigger(triggerInput.stateKey);
      if (eventTrigger) {
        if (!eventStateKeys(trigger).includes(eventTrigger.key)) throw new Error("AUTOMATION_TRIGGER_EVENT_UNSUPPORTED");
      } else if (!booleanStateKeys(trigger).includes(triggerInput.stateKey)) {
        throw new Error("AUTOMATION_TRIGGER_STATE_UNSUPPORTED");
      }
    }

    const actions = automationRuleActions(input);
    if (actions.length > 8) throw new Error("AUTOMATION_ACTION_LIMIT");
    if (new Set(actions.map(action => action.deviceId)).size !== actions.length) throw new Error("AUTOMATION_ACTION_DUPLICATE_DEVICE");
    for (const actionInput of actions) {
      const target = this.registry.get(actionInput.deviceId);
      if (!target) throw new Error("AUTOMATION_ACTION_DEVICE_NOT_FOUND");
      if (triggers.some(trigger => trigger.deviceId === actionInput.deviceId) && !virtualSelfResetAction(triggers, actionInput, target)) {
        throw new Error("AUTOMATION_TRIGGER_ACTION_SAME_DEVICE");
      }
      if (!actionCapabilitySupported(target, actionInput)) throw new Error(actionInput.action === "setTargetTemperature" ? "AUTOMATION_ACTION_TEMPERATURE_INVALID" : "AUTOMATION_ACTION_UNSUPPORTED");
    }

    const hasCondition = Boolean(input.conditionDeviceId);
    if (hasCondition) {
      if (triggers.some(trigger => trigger.deviceId === input.conditionDeviceId)) throw new Error("AUTOMATION_CONDITION_TRIGGER_SAME_DEVICE");
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
    assertAcyclic(this.rules, candidate, this.registry);
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
      additionalTriggers: current.additionalTriggers,
      conditionDeviceId: current.conditionDeviceId,
      conditionStateKey: current.conditionStateKey,
      conditionValue: current.conditionValue,
      actionDeviceId: current.actionDeviceId,
      action: current.action,
      actionValue: current.actionValue,
      additionalActions: current.additionalActions
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

    let successfulActions = 0;
    let failedActions = 0;
    const triggers = automationRuleTriggers(rule);
    const configuredActions = automationRuleActions(rule);
    // A virtual switch may act as a one-shot/latch trigger (for example a HomeKit
    // geofence sets it to ON). Execute its safe opposite-state reset only after all
    // other target actions have been attempted so the trigger is consumed last.
    const actions = [
      ...configuredActions.filter(action => !virtualSelfResetAction(triggers, action, this.registry.get(action.deviceId))),
      ...configuredActions.filter(action => virtualSelfResetAction(triggers, action, this.registry.get(action.deviceId)))
    ];
    for (const targetAction of actions) {
      const target = this.registry.get(targetAction.deviceId);
      if (!target || !target.reachable || !actionCapabilitySupported(target, targetAction)) {
        failedActions += 1;
        await this.logger.write("warning", "automation", "AUTOMATION_ACTION_SKIPPED", "Automation target action was skipped", {
          automationId: rule.id,
          automationName: rule.name,
          actionDeviceId: targetAction.deviceId,
          action: targetAction.action,
          reason: !target ? "device-not-found" : !target.reachable ? "device-unreachable" : "action-unsupported",
          ...trigger
        }).catch(() => undefined);
        continue;
      }

      try {
        const command = actionCommand(targetAction);
        await this.commander.command({
          deviceId: targetAction.deviceId,
          capability: command.capability,
          ...(command.value !== undefined ? { value: command.value } : {}),
          source: "automation"
        });
        successfulActions += 1;
      } catch (error) {
        failedActions += 1;
        await this.logger.write("error", "automation", "AUTOMATION_ACTION_FAILED", "Automation action failed", {
          automationId: rule.id,
          automationName: rule.name,
          actionDeviceId: targetAction.deviceId,
          action: targetAction.action,
          error: error instanceof Error ? error.message : String(error),
          ...trigger
        }).catch(() => undefined);
      }
    }

    if (successfulActions === 0) return;
    const triggeredAt = new Date().toISOString();
    await this.store.markTriggered(rule.id, triggeredAt);
    this.rules = this.rules.map(item => item.id === rule.id ? { ...item, lastTriggeredAt: triggeredAt } : item);
    await this.logger.write("info", "automation", "AUTOMATION_TRIGGERED", "Automation executed", {
      automationId: rule.id,
      automationName: rule.name,
      triggerDeviceId: rule.triggerDeviceId,
      actions: actions.map(action => ({ deviceId: action.deviceId, action: action.action, ...(action.value !== undefined ? { value: action.value } : {}) })),
      successfulActions,
      failedActions,
      ...trigger
    }).catch(() => undefined);
  }

  private async handleDevice(device: Device): Promise<void> {
    const previous = this.snapshots.get(device.id);
    this.snapshots.set(device.id, { ...device.state });
    if (!previous) return;

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      for (const trigger of automationRuleTriggers(rule)) {
        if (trigger.deviceId !== device.id || parseAutomationEventTrigger(trigger.stateKey)) continue;
        const before = booleanState(previous, trigger.stateKey);
        const current = booleanState(device.state, trigger.stateKey);
        if (current === undefined || current !== trigger.value || before === current) continue;
        this.queueRule(rule, {
          triggerType: "state",
          triggerDeviceId: trigger.deviceId,
          triggerStateKey: trigger.stateKey,
          triggerValue: current
        });
      }
    }
  }

  private handleDeviceEvent(event: DeviceEvent): void {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      for (const trigger of automationRuleTriggers(rule)) {
        if (trigger.deviceId !== event.deviceId) continue;
        const eventTrigger = parseAutomationEventTrigger(trigger.stateKey);
        if (!eventTrigger || eventTrigger.key !== event.key || eventTrigger.value !== event.value) continue;
        this.queueRule(rule, {
          triggerType: "event",
          triggerDeviceId: trigger.deviceId,
          triggerEventKey: event.key,
          triggerEventValue: event.value,
          triggerReceivedAt: event.receivedAt
        });
      }
    }
  }
}
