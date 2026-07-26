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
  paramsetDescription?: JsonRecord;
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
    return decodeURIComponent(text.replace(/\+/g, "%20"));
  } catch {
    return text;
  }
}

/** Reads and decodes the configured ReGa name from Device.get-like payloads. */
export function openCcuObjectName(value: unknown): string | undefined {
  const object = record(value);
  return decodedName(property(object, "name", "deviceName", "device_name", "label"));
}

export function openCcuDeviceIds(payload: unknown): string[] {
  const values = Array.isArray(payload)
    ? payload
    : Object.values(record(payload));
  const ids = values
    .map(value => {
      if (typeof value === "string" || typeof value === "number") return String(value).trim();
      return stringValue(property(record(value), "id", "deviceId", "device_id"));
    })
    .filter((value): value is string => Boolean(value));
  return [...new Set(ids)];
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

function parameterDefinition(snapshot: OpenCcuChannelSnapshot, key: string): JsonRecord {
  return record(property(snapshot.paramsetDescription ?? {}, key));
}

function parameterExists(snapshot: OpenCcuChannelSnapshot, key: string): boolean {
  return key in snapshot.values || Object.keys(parameterDefinition(snapshot, key)).length > 0;
}

function parameterWritable(snapshot: OpenCcuChannelSnapshot, key: string): boolean {
  const definition = parameterDefinition(snapshot, key);
  const operations = numberValue(property(definition, "operations"));
  // HomeMatic operation flags use bit 2 for write access. Older CCU versions
  // may omit the description, in which case the known control parameters are
  // treated as writable and OpenCCU remains the final authority.
  return operations === undefined || (operations & 2) === 2;
}

function rpcValueType(snapshot: OpenCcuChannelSnapshot, key: string, fallback: "bool" | "float" | "int" | "string"): string {
  const raw = stringValue(property(parameterDefinition(snapshot, key), "type"))?.toUpperCase();
  if (raw === "BOOL" || raw === "BOOLEAN") return "bool";
  if (["FLOAT", "DOUBLE"].includes(raw ?? "")) return "float";
  if (["INTEGER", "INT", "ENUM"].includes(raw ?? "")) return "int";
  if (["STRING", "ACTION"].includes(raw ?? "")) return "string";
  return fallback;
}

function parameterNumber(snapshot: OpenCcuChannelSnapshot, key: string, field: "min" | "max" | "default"): number | undefined {
  return numberValue(property(parameterDefinition(snapshot, key), field));
}

function targetTemperatureParameter(snapshot: OpenCcuChannelSnapshot): string | undefined {
  return ["SET_TEMPERATURE", "SET_POINT_TEMPERATURE", "TARGET_TEMPERATURE", "SETPOINT"]
    .find(key => parameterExists(snapshot, key));
}

function fallbackDeviceName(snapshot: Pick<OpenCcuChannelSnapshot, "model" | "channelAddress">): string {
  return `${snapshot.model ?? "HomeMatic"} ${snapshot.channelAddress}`;
}

function deviceName(snapshot: OpenCcuChannelSnapshot): string {
  // The card title represents the physical OpenCCU device. Channel names are
  // retained as metadata and are used only when the physical device has no
  // configured ReGa name. This avoids replacing a user-defined device name
  // with technical channel labels such as "DEVICE-NAME:4".
  if (snapshot.deviceName) return snapshot.deviceName.trim();
  if (snapshot.channelName) {
    const channel = snapshot.channelAddress.split(":").at(-1);
    const normalized = snapshot.channelName.trim();
    if (channel && normalized.toLocaleLowerCase().endsWith(`:${channel}`.toLocaleLowerCase())) {
      const parent = normalized.slice(0, -(channel.length + 1)).trim();
      if (parent) return parent;
    }
    return normalized;
  }
  return fallbackDeviceName(snapshot);
}

function adapterString(device: Device | undefined, key: string): string | undefined {
  const value = device?.adapterData?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Keeps a locally edited SALTA name while allowing names supplied by OpenCCU to
 * replace old generated fallbacks and to follow later renames in OpenCCU.
 */
export function reconciledOpenCcuName(existing: Device | undefined, discovered: Device): string {
  if (!existing) return discovered.name;
  const previousSourceName = adapterString(existing, "sourceName");
  const previousFallbackName = adapterString(existing, "sourceFallbackName")
    ?? `${existing.model ?? "HomeMatic"} ${adapterString(existing, "channelAddress") ?? existing.sourceId.split("|").at(-1) ?? ""}`.trim();
  const followsSourceName = previousSourceName !== undefined && existing.name === previousSourceName;
  const usesGeneratedFallback = existing.name === previousFallbackName;
  return followsSourceName || usesGeneratedFallback ? discovered.name : existing.name;
}

function idPart(value: string): string {
  return encodeURIComponent(value).replace(/%/g, "_");
}

function baseDevice(snapshot: OpenCcuChannelSnapshot): Omit<Device, "type" | "state" | "capabilities"> {
  const host = normalizeOpenCcuBaseUrl(snapshot.baseUrl);
  const reachableFlag = booleanValue(snapshot.values.UNREACH);
  const sourceName = deviceName(snapshot);
  const sourceFallbackName = fallbackDeviceName(snapshot);
  return {
    id: `openccu:${idPart(snapshot.interfaceName)}:${idPart(snapshot.channelAddress)}`,
    source: "openccu",
    sourceId: `${snapshot.interfaceName}|${snapshot.channelAddress}`,
    name: sourceName,
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
      channelType: snapshot.channelType,
      ...(snapshot.deviceName ? { deviceName: snapshot.deviceName } : {}),
      ...(snapshot.channelName ? { channelName: snapshot.channelName } : {}),
      sourceName,
      sourceFallbackName
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
  const actualTemperature = numberValue(values.ACTUAL_TEMPERATURE ?? values.TEMPERATURE);
  const humidity = numberValue(values.HUMIDITY);
  const targetParameter = targetTemperatureParameter(snapshot);
  const targetTemperature = targetParameter ? numberValue(values[targetParameter]) : undefined;

  if (targetParameter && (targetTemperature !== undefined || /(THERMOSTAT|CLIMATE|HEATING|RADIATOR|THERMAL_CONTROL)/.test(type))) {
    const valvePositionRaw = numberValue(values.VALVE_STATE ?? values.LEVEL);
    const valvePosition = valvePositionRaw === undefined
      ? undefined
      : Math.max(0, Math.min(100, valvePositionRaw <= 1 ? Math.round(valvePositionRaw * 100) : Math.round(valvePositionRaw)));
    const controlMode = stringValue(values.CONTROL_MODE ?? values.MODE ?? values.SET_POINT_MODE);
    const writable = parameterWritable(snapshot, targetParameter);
    return {
      ...base,
      type: "thermostat",
      state: {
        ...common,
        ...(actualTemperature !== undefined ? { temperature: actualTemperature } : {}),
        ...(humidity !== undefined ? { humidity } : {}),
        ...(targetTemperature !== undefined ? { targetTemperature } : {}),
        ...(valvePosition !== undefined ? { valvePosition } : {}),
        ...(controlMode ? { controlMode } : {})
      },
      capabilities: writable ? ["setTargetTemperature"] : [],
      adapterData: {
        ...(base.adapterData ?? {}),
        targetTemperatureParameter: targetParameter,
        targetTemperatureValueType: rpcValueType(snapshot, targetParameter, "float"),
        targetTemperatureMin: parameterNumber(snapshot, targetParameter, "min") ?? 5,
        targetTemperatureMax: parameterNumber(snapshot, targetParameter, "max") ?? 30,
        targetTemperatureStep: 0.5
      }
    };
  }

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
      capabilities: parameterWritable(snapshot, "LEVEL")
        ? ["open", "close", ...(parameterExists(snapshot, "STOP") && parameterWritable(snapshot, "STOP") ? ["stop"] : []), "setTargetPosition"]
        : [],
      coverSupport: true,
      adapterData: {
        ...(base.adapterData ?? {}),
        levelParameter: "LEVEL",
        levelValueType: rpcValueType(snapshot, "LEVEL", "float"),
        ...(parameterExists(snapshot, "STOP") ? { stopParameter: "STOP", stopValueType: rpcValueType(snapshot, "STOP", "bool") } : {})
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
      capabilities: parameterWritable(snapshot, "LEVEL") ? ["turnOn", "turnOff", "toggle", "setBrightness"] : [],
      switchSupport: true,
      lightSupport: true,
      adapterData: {
        ...(base.adapterData ?? {}),
        levelParameter: "LEVEL",
        levelValueType: rpcValueType(snapshot, "LEVEL", "float"),
        ...(stateValue !== undefined ? { stateParameter: "STATE", stateValueType: rpcValueType(snapshot, "STATE", "bool") } : {})
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
      capabilities: parameterWritable(snapshot, "STATE") ? ["turnOn", "turnOff", "toggle"] : [],
      switchSupport: true,
      adapterData: {
        ...(base.adapterData ?? {}),
        stateParameter: "STATE",
        stateValueType: rpcValueType(snapshot, "STATE", "bool")
      }
    };
  }

  const temperature = actualTemperature;
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

function recordArray(value: unknown, ...containerNames: string[]): JsonRecord[] {
  if (Array.isArray(value)) return value.map(record);
  const container = record(value);
  for (const name of containerNames) {
    const nested = property(container, name);
    if (Array.isArray(nested)) return nested.map(record);
  }
  return Object.values(container)
    .filter(item => item !== null && typeof item === "object" && !Array.isArray(item))
    .map(record);
}

export function openCcuCatalogFromDescriptions(
  interfaceName: string,
  descriptionsPayload: unknown,
  detailsPayload: unknown
): OpenCcuCatalogEntry[] {
  const descriptions = recordArray(descriptionsPayload, "devices", "result");
  const details = recordArray(detailsPayload, "devices", "result");
  const detailDevices = new Map<string, JsonRecord>();
  const detailChannels = new Map<string, JsonRecord>();

  for (const detail of details) {
    const channels = recordArray(property(detail, "channels"), "channels", "result");
    let inferredDeviceName: string | undefined;

    for (const channel of channels) {
      const channelAddress = stringValue(property(channel, "address", "channelAddress", "channel_address"));
      if (!channelAddress) continue;
      detailChannels.set(channelAddress, channel);

      if (!inferredDeviceName) {
        const channelName = decodedName(property(channel, "name", "channelName", "channel_name"));
        const channelIndex = channelAddress.split(":").at(-1);
        if (channelName && channelIndex && channelName.toLocaleLowerCase().endsWith(`:${channelIndex}`.toLocaleLowerCase())) {
          inferredDeviceName = channelName.slice(0, -(channelIndex.length + 1)).trim() || undefined;
        }
      }
    }

    const explicitDeviceName = decodedName(property(detail, "name", "deviceName", "device_name"));
    const enrichedDetail = explicitDeviceName || inferredDeviceName
      ? { ...detail, name: explicitDeviceName ?? inferredDeviceName }
      : detail;
    const detailAddress = stringValue(property(
      detail,
      "address",
      "deviceAddress",
      "device_address",
      "serial",
      "serialNumber",
      "serial_number"
    ));
    if (detailAddress) detailDevices.set(detailAddress, enrichedDetail);

    // Some OpenCCU versions omit the physical device address in the detail
    // object while still returning fully qualified channel addresses. Derive
    // the parent address from those channels so the ReGa names can still be
    // joined with Interface.listDevices.
    for (const channel of channels) {
      const channelAddress = stringValue(property(channel, "address", "channelAddress", "channel_address"));
      const parentAddress = channelAddress?.split(":")[0];
      if (parentAddress && !detailDevices.has(parentAddress)) detailDevices.set(parentAddress, enrichedDetail);
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

