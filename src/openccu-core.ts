import type { Device, DeviceState } from "./types.js";

export type JsonRecord = Record<string, unknown>;

export interface OpenCcuChannelSnapshot {
  baseUrl: string;
  interfaceName: string;
  channelAddress: string;
  channelType: string;
  deviceAddress: string;
  deviceName?: string;
  channelName?: string;
  model?: string;
  firmwareVersion?: string;
  channelCount?: number;
  values: JsonRecord;
}

export interface OpenCcuCatalogEntry extends Omit<OpenCcuChannelSnapshot, "baseUrl" | "values"> {}

const now = (): string => new Date().toISOString();

export function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function property(value: JsonRecord, ...names: string[]): unknown {
  for (const name of names) {
    if (name in value) return value[name];
    const upper = name.toUpperCase();
    if (upper in value) return value[upper];
    const lower = name.toLowerCase();
    if (lower in value) return value[lower];
  }
  return undefined;
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function decodedName(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "on", "open", "active"].includes(normalized)) return true;
    if (["false", "0", "off", "closed", "inactive"].includes(normalized)) return false;
  }
  return undefined;
}

export function normalizeOpenCcuBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("OPENCCU_URL_REQUIRED");
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("OPENCCU_URL_INVALID");
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !parsed.hostname) {
    throw new Error("OPENCCU_URL_INVALID");
  }
  if (parsed.pathname && parsed.pathname !== "/") throw new Error("OPENCCU_URL_INVALID");
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function openCcuRpcEndpoint(baseUrl: string): string {
  return `${normalizeOpenCcuBaseUrl(baseUrl)}/api/homematic.cgi`;
}

export function stringifyRpcParams(params: JsonRecord): JsonRecord {
  const result: JsonRecord = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "boolean") result[key] = value ? "true" : "false";
    else if (value === null || value === undefined) result[key] = "";
    else result[key] = String(value);
  }
  return result;
}

export function unwrapRpcResult(payload: unknown): unknown {
  const body = record(payload);
  const rawError = body.error;
  if (rawError !== null && rawError !== undefined && rawError !== false && rawError !== "") {
    const error = record(rawError);
    const code = stringValue(error.code) ?? String(error.code ?? "OPENCCU_API_ERROR");
    const message = stringValue(error.message) ?? stringValue(rawError) ?? "OpenCCU returned a JSON-RPC error.";
    throw new Error(`OPENCCU_API_ERROR:${code}:${message}`);
  }
  if (!("result" in body)) throw new Error("OPENCCU_INVALID_RESPONSE");
  return body.result;
}

function normalizedType(snapshot: OpenCcuChannelSnapshot): string {
  return `${snapshot.channelType} ${snapshot.model ?? ""}`.toUpperCase();
}

function stateFromCommonValues(values: JsonRecord): DeviceState {
  const state: DeviceState = {};
  const lowBattery = booleanValue(values.LOWBAT ?? values.LOW_BAT);
  if (lowBattery !== undefined) state.lowBattery = lowBattery;
  const operatingVoltage = numberValue(values.OPERATING_VOLTAGE ?? values.BATTERY_STATE);
  if (operatingVoltage !== undefined) state.voltage = operatingVoltage;
  const rssi = numberValue(values.RSSI_DEVICE ?? values.RSSI_PEER);
  if (rssi !== undefined) state.rssi = rssi;
  const power = numberValue(values.POWER);
  if (power !== undefined) state.power = power;
  const current = numberValue(values.CURRENT);
  if (current !== undefined) state.current = current;
  const voltage = numberValue(values.VOLTAGE);
  if (voltage !== undefined) state.voltage = voltage;
  const frequency = numberValue(values.FREQUENCY);
  if (frequency !== undefined) state.frequency = frequency;
  const energy = numberValue(values.ENERGY_COUNTER ?? values.ENERGY_COUNTER_WH ?? values.ENERGY);
  if (energy !== undefined) state.energy = energy;
  return state;
}

function isContactChannel(type: string): boolean {
  return /(SHUTTER_CONTACT|CONTACT|WINDOW|DOOR_SENSOR|ROTARY_HANDLE)/.test(type);
}

function isMotionChannel(type: string): boolean {
  return /(MOTION|PRESENCE)/.test(type);
}

function isCoverChannel(type: string, values: JsonRecord): boolean {
  return /(SHUTTER|BLIND|JALOUSIE|WINDOW_DRIVE|GARAGE_DOOR)/.test(type)
    || (numberValue(values.LEVEL) !== undefined && ("STOP" in values || "ACTIVITY_STATE" in values || "DIRECTION" in values));
}

function isLightChannel(type: string, values: JsonRecord): boolean {
  return /(DIMMER|LIGHT|COLOR|RGB|CCT)/.test(type)
    || (numberValue(values.LEVEL) !== undefined && booleanValue(values.STATE) !== undefined);
}

function isSwitchChannel(type: string, values: JsonRecord): boolean {
  return booleanValue(values.STATE) !== undefined && /(SWITCH|OUTPUT|ACTUATOR|RELAY|PLUG)/.test(type);
}

function deviceName(snapshot: OpenCcuChannelSnapshot): string {
  if (snapshot.channelName) return snapshot.channelName;
  if (snapshot.deviceName) {
    const channel = snapshot.channelAddress.split(":").at(-1);
    return channel && channel !== "1" ? `${snapshot.deviceName} · Kanal ${channel}` : snapshot.deviceName;
  }
  return `${snapshot.model ?? "HomeMatic"} ${snapshot.channelAddress}`;
}

function idPart(value: string): string {
  return encodeURIComponent(value).replace(/%/g, "_");
}

function baseDevice(snapshot: OpenCcuChannelSnapshot): Omit<Device, "type" | "state" | "capabilities"> {
  const host = normalizeOpenCcuBaseUrl(snapshot.baseUrl);
  const reachableFlag = booleanValue(snapshot.values.UNREACH);
  return {
    id: `openccu:${idPart(snapshot.interfaceName)}:${idPart(snapshot.channelAddress)}`,
    source: "openccu",
    sourceId: `${snapshot.interfaceName}|${snapshot.channelAddress}`,
    name: deviceName(snapshot),
    host,
    model: snapshot.model,
    firmwareVersion: snapshot.firmwareVersion,
    hostname: new URL(host).hostname,
    macAddress: snapshot.deviceAddress,
    profile: snapshot.interfaceName,
    channelCount: snapshot.channelCount,
    reachable: reachableFlag === undefined ? true : !reachableFlag,
    homekitEnabled: false,
    hidden: false,
    credentialMode: "none",
    passwordConfigured: false,
    lastSeen: now(),
    lastEvent: now(),
    adapterData: {
      interfaceName: snapshot.interfaceName,
      channelAddress: snapshot.channelAddress,
      channelType: snapshot.channelType
    }
  };
}

export function openCcuDeviceFromChannel(snapshot: OpenCcuChannelSnapshot): Device | undefined {
  const values = snapshot.values;
  const type = normalizedType(snapshot);
  const common = stateFromCommonValues(values);
  const base = baseDevice(snapshot);
  const level = numberValue(values.LEVEL);
  const stateValue = booleanValue(values.STATE);

  if (isCoverChannel(type, values) && level !== undefined) {
    const position = Math.max(0, Math.min(100, Math.round(level * 100)));
    const positionStateRaw = stringValue(values.ACTIVITY_STATE ?? values.DIRECTION ?? values.PROCESS);
    return {
      ...base,
      type: "windowCovering",
      state: {
        ...common,
        currentPosition: position,
        targetPosition: position,
        ...(positionStateRaw ? { positionState: positionStateRaw } : {})
      },
      capabilities: ["open", "close", ...("STOP" in values ? ["stop"] : []), "setTargetPosition"],
      coverSupport: true,
      adapterData: {
        ...(base.adapterData ?? {}),
        levelParameter: "LEVEL",
        levelValueType: "double",
        ...("STOP" in values ? { stopParameter: "STOP", stopValueType: "boolean" } : {})
      }
    };
  }

  if (isLightChannel(type, values) && level !== undefined) {
    const brightness = Math.max(0, Math.min(100, Math.round(level * 100)));
    const on = stateValue ?? brightness > 0;
    return {
      ...base,
      type: "light",
      state: { ...common, on, brightness },
      capabilities: ["turnOn", "turnOff", "toggle", "setBrightness"],
      switchSupport: true,
      lightSupport: true,
      adapterData: {
        ...(base.adapterData ?? {}),
        levelParameter: "LEVEL",
        levelValueType: "double",
        ...(stateValue !== undefined ? { stateParameter: "STATE", stateValueType: "boolean" } : {})
      }
    };
  }

  if (isContactChannel(type) && stateValue !== undefined) {
    return { ...base, type: "contactSensor", state: { ...common, open: stateValue }, capabilities: [] };
  }

  const motion = booleanValue(values.MOTION ?? values.PRESENCE ?? values.PRESENCE_DETECTION_STATE);
  if (isMotionChannel(type) && motion !== undefined) {
    return { ...base, type: "motionSensor", state: { ...common, motion }, capabilities: [] };
  }

  if (isSwitchChannel(type, values) && stateValue !== undefined) {
    return {
      ...base,
      type: "switch",
      state: { ...common, on: stateValue },
      capabilities: ["turnOn", "turnOff", "toggle"],
      switchSupport: true,
      adapterData: {
        ...(base.adapterData ?? {}),
        stateParameter: "STATE",
        stateValueType: "boolean"
      }
    };
  }

  const temperature = numberValue(values.ACTUAL_TEMPERATURE ?? values.TEMPERATURE);
  const humidity = numberValue(values.HUMIDITY);
  if (temperature !== undefined || humidity !== undefined) {
    return {
      ...base,
      type: temperature !== undefined ? "temperatureSensor" : "humiditySensor",
      state: {
        ...common,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(humidity !== undefined ? { humidity } : {})
      },
      capabilities: []
    };
  }

  const lux = numberValue(values.ILLUMINATION ?? values.LUX ?? values.BRIGHTNESS);
  if (lux !== undefined && /(ILLUMINATION|BRIGHTNESS|LIGHT_SENSOR|WEATHER)/.test(type)) {
    return { ...base, type: "lightSensor", state: { ...common, lux }, capabilities: [] };
  }

  const water = booleanValue(values.WATERLEVEL_DETECTED ?? values.MOISTURE_DETECTED ?? values.WATER_DETECTION_RESULT);
  if (water !== undefined || /(WATER|LEAK|MOISTURE)/.test(type)) {
    return { ...base, type: "waterLeakSensor", state: { ...common, water: water ?? false }, capabilities: [] };
  }

  const smokeRaw = values.SMOKE_DETECTOR_ALARM_STATUS ?? values.SMOKE_DETECTOR_TEST_RESULT ?? values.SMOKE_ALARM;
  const smokeBoolean = booleanValue(smokeRaw);
  const smokeNumeric = numberValue(smokeRaw);
  const smokeText = stringValue(smokeRaw)?.toUpperCase();
  const smokeAlarm = smokeBoolean
    ?? (smokeNumeric !== undefined ? Boolean(smokeNumeric) : undefined)
    ?? (smokeText ? /(ALARM|FIRE|SMOKE)/.test(smokeText) && !/(IDLE|NONE|NO_ALARM|OFF)/.test(smokeText) : undefined);
  if (smokeAlarm !== undefined || /SMOKE/.test(type)) {
    return { ...base, type: "smokeSensor", state: { ...common, fire: smokeAlarm ?? false }, capabilities: [] };
  }

  if (Object.keys(common).some(key => ["power", "current", "voltage", "frequency", "energy"].includes(key))) {
    return { ...base, type: "energyMeter", state: common, capabilities: [], powerMetering: true };
  }

  const meaningful = Object.entries(values)
    .filter(([key, value]) => !["UNREACH", "STICKY_UNREACH", "CONFIG_PENDING", "UPDATE_PENDING"].includes(key) && ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 4);
  if (!meaningful.length) return undefined;
  const state: DeviceState = { ...common };
  for (const [key, value] of meaningful) state[key.toLowerCase()] = value as string | number | boolean;
  return { ...base, type: "genericSensor", state, capabilities: [] };
}

export function interfaceNames(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map(item => typeof item === "string" ? item : stringValue(property(record(item), "name", "interface")))
    .filter((value): value is string => Boolean(value));
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item));
  if (typeof value === "string") return value.split(/[ ,]+/).filter(Boolean);
  return [];
}

export function openCcuCatalogFromDescriptions(
  interfaceName: string,
  descriptionsPayload: unknown,
  detailsPayload: unknown
): OpenCcuCatalogEntry[] {
  const descriptions = Array.isArray(descriptionsPayload) ? descriptionsPayload.map(record) : [];
  const details = Array.isArray(detailsPayload) ? detailsPayload.map(record) : [];
  const detailDevices = new Map<string, JsonRecord>();
  const detailChannels = new Map<string, JsonRecord>();

  for (const detail of details) {
    const address = stringValue(property(detail, "address"));
    if (address) detailDevices.set(address, detail);
    const channels = property(detail, "channels");
    if (Array.isArray(channels)) {
      for (const channel of channels) {
        const raw = record(channel);
        const channelAddress = stringValue(property(raw, "address"));
        if (channelAddress) detailChannels.set(channelAddress, raw);
      }
    }
  }

  const deviceDescriptions = new Map<string, JsonRecord>();
  for (const description of descriptions) {
    const address = stringValue(property(description, "address"));
    if (address && !address.includes(":")) deviceDescriptions.set(address, description);
  }

  const catalog: OpenCcuCatalogEntry[] = [];
  for (const description of descriptions) {
    const channelAddress = stringValue(property(description, "address"));
    const parent = stringValue(property(description, "parent", "parentAddress"));
    if (!channelAddress || !parent || !channelAddress.includes(":") || channelAddress.endsWith(":0")) continue;
    if (!stringArray(property(description, "paramsets")).some(paramset => paramset.toUpperCase() === "VALUES")) continue;
    const channelType = stringValue(property(description, "type")) ?? "CHANNEL";
    if (/(MAINTENANCE|CENTRAL_KEY|KEY_TRANSCEIVER|VIRTUAL_KEY|REMOTE_CONTROL_RECEIVER|TRANSMITTER)$/i.test(channelType)) continue;

    const parentDescription = deviceDescriptions.get(parent) ?? {};
    const deviceDetail = detailDevices.get(parent) ?? {};
    const channelDetail = detailChannels.get(channelAddress) ?? {};
    const children = property(parentDescription, "children");
    catalog.push({
      interfaceName,
      channelAddress,
      channelType,
      deviceAddress: parent,
      deviceName: decodedName(property(deviceDetail, "name", "deviceName", "device_name")),
      channelName: decodedName(property(channelDetail, "name", "channelName", "channel_name")),
      model: stringValue(property(parentDescription, "type")),
      firmwareVersion: stringValue(property(parentDescription, "firmware")),
      channelCount: Array.isArray(children) && children.length ? children.length : undefined
    });
  }
  return catalog;
}

