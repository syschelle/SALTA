import type { DeviceState, DeviceType, ShellyComponentKind } from "./types.js";

type JsonRecord = Record<string, unknown>;

type ComponentEntry = {
  key: string;
  kind: ShellyComponentKind;
  id: number;
  value: JsonRecord;
};

export interface ShellyDetection {
  type: DeviceType;
  profile?: string;
  state: DeviceState;
  capabilities: string[];
  componentKind?: ShellyComponentKind;
  componentId?: number;
  channelCount: number;
  powerMetering: boolean;
  coverSupport: boolean;
  switchSupport: boolean;
  lightSupport: boolean;
  inputSupport: boolean;
}

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function boolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === 0 || value === "0" || value === "off") return false;
  if (value === 1 || value === "1" || value === "on") return true;
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = number(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function setNumber(state: DeviceState, key: string, ...values: unknown[]): void {
  const value = firstNumber(...values);
  if (value !== undefined) state[key] = value;
}

function setBoolean(state: DeviceState, key: string, ...values: unknown[]): void {
  for (const value of values) {
    const parsed = boolean(value);
    if (parsed !== undefined) {
      state[key] = parsed;
      return;
    }
  }
}

function setText(state: DeviceState, key: string, ...values: unknown[]): void {
  for (const value of values) {
    const parsed = text(value);
    if (parsed !== undefined) {
      state[key] = parsed;
      return;
    }
  }
}

function normalizeIdentity(...values: unknown[]): string {
  return values.map(value => text(value) ?? "").join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isOutlet(identity: string): boolean {
  return /(plug|socket|powerstrip|shplg)/.test(identity);
}

function isLight(identity: string): boolean {
  return /(light|dimmer|bulb|duo|rgb|rgbw|cct|vintage)/.test(identity);
}

function isGen1VirtualPowerModel(identity: string): boolean {
  // Shelly 1 (SHSW-1) has no physical power meter. Its meters[0].power value
  // is only a user-configured nominal load and must not be presented as live power.
  return identity === "shsw1";
}

function isDedicatedEnergyMeter(identity: string): boolean {
  return /(pro3em|proem|shelly3em|shellyem|emmini|pmmini|emg3|emg4|shem)/.test(identity)
    && !/(1pm|2pm|4pm|plugpm)/.test(identity);
}

function capabilities(type: DeviceType): string[] {
  switch (type) {
    case "windowCovering": return ["open", "close", "stop", "setTargetPosition"];
    case "light": return ["turnOn", "turnOff", "toggle", "setBrightness"];
    case "energyMeter": return [];
    default: return ["turnOn", "turnOff", "toggle"];
  }
}

function componentEntries(status: unknown): ComponentEntry[] {
  const entries: ComponentEntry[] = [];
  for (const [key, rawValue] of Object.entries(record(status))) {
    const match = key.match(/^(switch|light|cover|rgb|rgbw|cct|em|em1|pm1):(\d+)$/i);
    if (!match) continue;
    const kind = match[1]?.toLowerCase() as ShellyComponentKind | undefined;
    const id = Number(match[2]);
    if (!kind || !Number.isInteger(id)) continue;
    entries.push({ key, kind, id, value: record(rawValue) });
  }
  return entries;
}

function meterFor(entries: ComponentEntry[], id: number): JsonRecord {
  const candidates = entries.filter(entry => entry.kind === "pm1" || entry.kind === "em1");
  const matching = candidates.find(entry => entry.id === id);
  if (matching) return matching.value;
  return candidates.length === 1 ? candidates[0]?.value ?? {} : {};
}

function energyTotal(value: JsonRecord): unknown {
  return record(value.aenergy).total
    ?? record(value.energy).total
    ?? record(value.total_act_energy).total
    ?? value.total_act_energy
    ?? value.total_energy
    ?? value.total;
}

function switchOrLightState(value: JsonRecord, meter: JsonRecord, light: boolean): DeviceState {
  const state: DeviceState = {};
  setBoolean(state, "on", value.output, value.ison);
  if (light) setNumber(state, "brightness", value.brightness, value.gain);
  // A dedicated PM1/EM1 component is the authoritative measurement source when present.
  setNumber(state, "power", meter.apower, meter.act_power, meter.active_power, meter.power, value.apower, value.act_power, value.active_power, value.power);
  setNumber(state, "energy", energyTotal(meter), energyTotal(value));
  setNumber(state, "voltage", meter.voltage, value.voltage);
  setNumber(state, "current", meter.current, value.current);
  setNumber(state, "frequency", meter.freq, meter.frequency, value.freq, value.frequency);
  setNumber(state, "temperature", record(meter.temperature).tC, record(value.temperature).tC, value.temperature);
  return state;
}

function coverState(value: JsonRecord): DeviceState {
  const state: DeviceState = {};
  setNumber(state, "currentPosition", value.current_pos);
  setNumber(state, "targetPosition", value.target_pos, value.current_pos);
  setText(state, "positionState", value.state);
  setNumber(state, "power", value.apower, value.power);
  setNumber(state, "voltage", value.voltage);
  setNumber(state, "current", value.current);
  return state;
}

function phasePower(value: JsonRecord, phase: "a" | "b" | "c"): unknown {
  return value[`${phase}_act_power`] ?? record(value[phase]).act_power ?? record(value[phase]).power;
}

function energyMeterState(entries: ComponentEntry[]): DeviceState {
  const state: DeviceState = {};
  const meters = entries.filter(entry => entry.kind === "em" || entry.kind === "em1" || entry.kind === "pm1");
  const powers = meters.flatMap(entry => {
    const value = entry.value;
    const total = firstNumber(value.total_act_power, value.act_power, value.apower, value.power);
    if (total !== undefined) return [total];
    return [phasePower(value, "a"), phasePower(value, "b"), phasePower(value, "c")]
      .map(item => number(item))
      .filter((item): item is number => item !== undefined);
  });
  if (powers.length) state.totalPower = powers.reduce((sum, value) => sum + value, 0);

  const primary = meters[0]?.value ?? {};
  setNumber(state, "powerL1", phasePower(primary, "a"));
  setNumber(state, "powerL2", phasePower(primary, "b"));
  setNumber(state, "powerL3", phasePower(primary, "c"));
  setNumber(state, "voltage", primary.voltage, primary.a_voltage, record(primary.a).voltage);
  setNumber(state, "current", primary.current, primary.a_current, record(primary.a).current);

  const energyValues = meters.map(entry => {
    const direct = firstNumber(
      record(entry.value.aenergy).total,
      record(entry.value.total_act_energy).total,
      entry.value.total_act_energy,
      entry.value.total
    );
    if (direct !== undefined) return direct;
    const phases = [entry.value.a_total_act_energy, entry.value.b_total_act_energy, entry.value.c_total_act_energy]
      .map(item => number(item))
      .filter((item): item is number => item !== undefined);
    return phases.length ? phases.reduce((sum, value) => sum + value, 0) : undefined;
  }).filter((item): item is number => item !== undefined);
  if (energyValues.length) state.energy = energyValues.reduce((sum, value) => sum + value, 0);
  return state;
}

function detectionForComponent(
  type: DeviceType,
  primary: ComponentEntry,
  entries: ComponentEntry[],
  profile: string | undefined,
  channelCount: number,
  inputSupport: boolean
): ShellyDetection {
  let state: DeviceState;
  if (type === "windowCovering") {
    state = coverState(primary.value);
  } else if (type === "energyMeter") {
    state = energyMeterState(entries);
  } else {
    state = switchOrLightState(primary.value, meterFor(entries, primary.id), type === "light");
  }

  const covers = entries.filter(entry => entry.kind === "cover");
  const lights = entries.filter(entry => ["light", "rgb", "rgbw", "cct"].includes(entry.kind));
  const switches = entries.filter(entry => entry.kind === "switch");
  const energyMeters = entries.filter(entry => ["em", "em1", "pm1"].includes(entry.kind));

  return {
    type,
    profile,
    state,
    capabilities: capabilities(type),
    componentKind: primary.kind,
    componentId: primary.id,
    channelCount: Math.max(channelCount, 1),
    powerMetering: energyMeters.length > 0 || state.power !== undefined || state.totalPower !== undefined,
    coverSupport: covers.length > 0,
    switchSupport: switches.length > 0,
    lightSupport: lights.length > 0,
    inputSupport
  };
}

/**
 * Detect every independently controllable logical device exposed by a Gen2+
 * Shelly. Multi-profile two-channel devices expose one cover in cover profile
 * and one logical switch per Switch component in switch profile.
 */
export function detectRpcShellyComponents(info: unknown, status: unknown): ShellyDetection[] {
  const infoRecord = record(info);
  const entries = componentEntries(status);
  const identity = normalizeIdentity(infoRecord.app, infoRecord.model, infoRecord.name, infoRecord.id);
  const declaredProfile = text(infoRecord.profile)?.toLowerCase();

  const covers = entries.filter(entry => entry.kind === "cover").sort((a, b) => a.id - b.id);
  const lights = entries.filter(entry => ["light", "rgb", "rgbw", "cct"].includes(entry.kind)).sort((a, b) => a.id - b.id);
  const switches = entries.filter(entry => entry.kind === "switch").sort((a, b) => a.id - b.id);
  const energyMeters = entries.filter(entry => ["em", "em1", "pm1"].includes(entry.kind)).sort((a, b) => a.id - b.id);
  const inputs = Object.keys(record(status)).filter(key => /^input:\d+$/i.test(key));
  const inputSupport = inputs.length > 0;

  // The active component set is the most reliable fallback when older firmware
  // omits profile from Shelly.GetDeviceInfo or /shelly.
  const profile = declaredProfile ?? (covers.length > 0 ? "cover" : switches.length > 1 ? "switch" : undefined);

  if ((profile === "cover" || covers.length > 0) && covers.length > 0) {
    return [detectionForComponent("windowCovering", covers[0]!, entries, "cover", 1, inputSupport)];
  }

  if (lights.length > 0 || isLight(identity)) {
    const primary = lights[0];
    if (!primary) throw new Error("UNSUPPORTED_SHELLY_DEVICE");
    return [detectionForComponent("light", primary, entries, profile, lights.length, inputSupport)];
  }

  if (isDedicatedEnergyMeter(identity) && energyMeters.length > 0) {
    return [detectionForComponent("energyMeter", energyMeters[0]!, entries, profile, energyMeters.length, inputSupport)];
  }

  if (switches.length > 0) {
    const type: DeviceType = isOutlet(identity) ? "outlet" : "switch";
    return switches.map(primary => detectionForComponent(type, primary, entries, profile ?? "switch", switches.length, inputSupport));
  }

  if (energyMeters.length > 0) {
    return [detectionForComponent("energyMeter", energyMeters[0]!, entries, profile, energyMeters.length, inputSupport)];
  }

  throw new Error("UNSUPPORTED_SHELLY_DEVICE");
}

export function detectRpcShelly(info: unknown, status: unknown): ShellyDetection {
  const detection = detectRpcShellyComponents(info, status)[0];
  if (!detection) throw new Error("UNSUPPORTED_SHELLY_DEVICE");
  return detection;
}

function firstRecordItem(value: unknown): JsonRecord {
  return record(array(value)[0]);
}

function gen1MeterState(status: JsonRecord, index = 0): JsonRecord {
  return record(array(status.meters)[index]);
}

export function detectGen1Shelly(settings: unknown, status: unknown): ShellyDetection {
  const settingsRecord = record(settings);
  const statusRecord = record(status);
  const device = record(settingsRecord.device);
  const modelIdentity = normalizeIdentity(device.type);
  const identity = normalizeIdentity(device.type, device.hostname, settingsRecord.name);
  const rollers = array(statusRecord.rollers);
  const lights = array(statusRecord.lights);
  const relays = array(statusRecord.relays);
  const emeters = array(statusRecord.emeters);
  const inputs = array(statusRecord.inputs);

  let type: DeviceType;
  if (rollers.length > 0 || text(settingsRecord.mode)?.toLowerCase() === "roller") type = "windowCovering";
  else if (lights.length > 0 || isLight(identity)) type = "light";
  else if (emeters.length > 0 && (relays.length === 0 || isDedicatedEnergyMeter(identity))) type = "energyMeter";
  else if (relays.length > 0) type = isOutlet(identity) ? "outlet" : "switch";
  else if (emeters.length > 0) type = "energyMeter";
  else throw new Error("UNSUPPORTED_SHELLY_DEVICE");

  const hasPhysicalPowerMeter = !isGen1VirtualPowerModel(modelIdentity);
  const state: DeviceState = {};
  if (type === "windowCovering") {
    const roller = firstRecordItem(statusRecord.rollers);
    setNumber(state, "currentPosition", roller.current_pos);
    setNumber(state, "targetPosition", roller.current_pos);
    setText(state, "positionState", roller.state);
    setNumber(state, "power", roller.power);
    const meter = gen1MeterState(statusRecord);
    const rawEnergy = number(meter.total);
    setNumber(state, "energy", rawEnergy === undefined ? undefined : rawEnergy / 60);
  } else if (type === "light") {
    const light = firstRecordItem(statusRecord.lights);
    setBoolean(state, "on", light.ison, light.output);
    setNumber(state, "brightness", light.brightness, light.gain);
    const meter = gen1MeterState(statusRecord);
    setNumber(state, "power", light.power, meter.power);
    const rawEnergy = firstNumber(light.total, meter.total);
    setNumber(state, "energy", rawEnergy === undefined ? undefined : rawEnergy / 60);
  } else if (type === "energyMeter") {
    const meters = emeters.map(record);
    const powers = meters.map(meter => number(meter.power)).filter((item): item is number => item !== undefined);
    if (powers.length) state.totalPower = powers.reduce((sum, value) => sum + value, 0);
    meters.slice(0, 3).forEach((meter, index) => setNumber(state, `powerL${index + 1}`, meter.power));
    const energy = meters.map(meter => number(meter.total)).filter((item): item is number => item !== undefined);
    if (energy.length) state.energy = energy.reduce((sum, value) => sum + value, 0);
  } else {
    const relay = firstRecordItem(statusRecord.relays);
    const meter = gen1MeterState(statusRecord);
    setBoolean(state, "on", relay.ison, relay.output);
    if (hasPhysicalPowerMeter) {
      setNumber(state, "power", meter.power, relay.power);
      const rawEnergy = firstNumber(meter.total, relay.total);
      setNumber(state, "energy", rawEnergy === undefined ? undefined : rawEnergy / 60);
    }
    setNumber(state, "temperature", statusRecord.temperature, record(statusRecord.tmp).tC);
  }

  return {
    type,
    state,
    capabilities: capabilities(type),
    componentKind: type === "windowCovering" ? "cover" : type === "light" ? "light" : type === "energyMeter" ? "em" : "switch",
    componentId: 0,
    channelCount: Math.max(type === "windowCovering" ? rollers.length : type === "light" ? lights.length : type === "energyMeter" ? emeters.length : relays.length, 1),
    powerMetering: hasPhysicalPowerMeter && (emeters.length > 0 || array(statusRecord.meters).length > 0 || state.power !== undefined || state.totalPower !== undefined),
    coverSupport: rollers.length > 0,
    switchSupport: relays.length > 0,
    lightSupport: lights.length > 0,
    inputSupport: inputs.length > 0 || statusRecord.input !== undefined
  };
}
