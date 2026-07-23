import { createHash } from "node:crypto";
import type { Device, DeviceState, DeviceType, PhosconGatewayStatus } from "./types.js";

const timeoutMs = 8_000;
const now = (): string => new Date().toISOString();
type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function timestamp(value: unknown, fallback = now()): string {
  const raw = stringValue(value);
  if (!raw || raw.toLowerCase() === "none") return fallback;
  const normalized = /(?:z|[+-]\d\d:\d\d)$/i.test(raw) ? raw : `${raw}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

export function normalizePhosconBaseUrl(value: string): string {
  const input = value.trim();
  if (!input) throw new Error("PHOSCON_URL_REQUIRED");
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `http://${input}`;
  let parsed: URL;
  try { parsed = new URL(candidate); }
  catch { throw new Error("PHOSCON_URL_INVALID"); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("PHOSCON_URL_INVALID");
  if (!parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("PHOSCON_URL_INVALID");
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return parsed.toString().replace(/\/$/, "");
}

function phosconApiError(payload: unknown): string | undefined {
  if (!Array.isArray(payload)) return undefined;
  for (const item of payload) {
    const error = record(record(item).error);
    const description = stringValue(error.description);
    if (description) return description;
  }
  return undefined;
}

export async function requestJson(url: string, method = "GET", body?: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => undefined) as unknown;
    const apiError = phosconApiError(payload);
    if (!response.ok || apiError) {
      if (/link button not pressed|gateway not unlocked/i.test(apiError ?? "")) throw new Error("PHOSCON_GATEWAY_LOCKED");
      if (response.status === 401 || response.status === 403 || /unauthorized user|invalid value.*username/i.test(apiError ?? "")) {
        throw new Error("PHOSCON_AUTHENTICATION_FAILED");
      }
      throw new Error(apiError ? `PHOSCON_API_ERROR:${apiError}` : `PHOSCON_HTTP_${response.status}`);
    }
    if (payload === undefined) throw new Error("PHOSCON_INVALID_RESPONSE");
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("PHOSCON_TIMEOUT");
    if (error instanceof TypeError) throw new Error("PHOSCON_UNREACHABLE");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function resourceMac(uniqueId: string | undefined): string | undefined {
  if (!uniqueId) return undefined;
  const mac = uniqueId.split("-", 1)[0]?.toLowerCase();
  return mac && /^([0-9a-f]{2}:){7}[0-9a-f]{2}$/.test(mac) ? mac : undefined;
}

function deviceId(gatewayIdentity: string, resourceKind: "light" | "sensor", resourceId: string, uniqueId: string | undefined): string {
  const stableResource = uniqueId ?? resourceId;
  const digest = createHash("sha1").update(`${gatewayIdentity}:${resourceKind}:${stableResource}`).digest("hex").slice(0, 20);
  return `phoscon:${digest}`;
}

function sensorDeviceType(type: string): DeviceType {
  const normalized = type.toLowerCase();
  if (normalized.includes("presence")) return "motionSensor";
  if (normalized.includes("openclose")) return "contactSensor";
  if (normalized.includes("temperature")) return "temperatureSensor";
  if (normalized.includes("humidity")) return "humiditySensor";
  if (normalized.includes("lightlevel")) return "lightSensor";
  if (normalized.includes("water")) return "waterLeakSensor";
  if (normalized.includes("fire") || normalized.includes("carbonmonoxide") || normalized.includes("alarm")) return "smokeSensor";
  if (normalized.includes("switch")) return "button";
  if (normalized.includes("power") || normalized.includes("consumption")) return "energyMeter";
  return "genericSensor";
}

function lightDeviceType(type: string, name: string, model: string): DeviceType {
  const combined = `${type} ${name} ${model}`.toLowerCase();
  if (combined.includes("window covering")) return "windowCovering";
  if (combined.includes("plug") || combined.includes("outlet") || combined.includes("steckdose")) return "outlet";
  return "light";
}

function copyScalar(target: DeviceState, key: string, value: unknown): void {
  if (typeof value === "string" || typeof value === "boolean") target[key] = value;
  else {
    const numeric = numberValue(value);
    if (numeric !== undefined) target[key] = numeric;
  }
}

function sensorState(rawState: JsonRecord, rawConfig: JsonRecord): DeviceState {
  const state: DeviceState = {};
  const temperature = numberValue(rawState.temperature);
  const humidity = numberValue(rawState.humidity);
  const presence = booleanValue(rawState.presence);
  if (presence !== undefined) state.motion = presence;
  const open = booleanValue(rawState.open);
  if (open !== undefined) state.open = open;
  if (temperature !== undefined) state.temperature = Math.round(temperature) / 100;
  if (humidity !== undefined) state.humidity = Math.round(humidity) / 100;
  for (const key of ["lux", "lightlevel", "pressure", "power", "current", "voltage", "consumption", "airquality", "airqualityppb", "water", "fire", "carbonmonoxide", "alarm", "vibration", "buttonevent", "gesture", "dark", "daylight", "lowbattery", "tampered", "charging"] as const) {
    copyScalar(state, key === "buttonevent" ? "buttonEvent" : key === "carbonmonoxide" ? "carbonMonoxide" : key === "lowbattery" ? "lowBattery" : key, rawState[key]);
  }
  copyScalar(state, "battery", rawConfig.battery);
  return state;
}

function lightState(rawState: JsonRecord, type: DeviceType): DeviceState {
  const state: DeviceState = {};
  copyScalar(state, "on", rawState.on);
  const brightness = numberValue(rawState.bri);
  if (brightness !== undefined) state.brightness = Math.round((Math.max(0, Math.min(254, brightness)) / 254) * 100);
  copyScalar(state, "colorTemperature", rawState.ct);
  copyScalar(state, "power", rawState.power);
  copyScalar(state, "energy", rawState.consumption);
  if (type === "windowCovering") {
    const lift = numberValue(rawState.lift);
    if (lift !== undefined) {
      const position = 100 - Math.max(0, Math.min(100, lift));
      state.currentPosition = position;
      state.targetPosition = position;
    }
  }
  return state;
}

function mappedLight(baseUrl: string, gatewayIdentity: string, resourceId: string, rawValue: unknown): Device | undefined {
  const raw = record(rawValue);
  const rawState = record(raw.state);
  const name = stringValue(raw.name) ?? `Zigbee light ${resourceId}`;
  const model = stringValue(raw.modelid) ?? "Zigbee light";
  const profile = stringValue(raw.type) ?? "Light";
  const uniqueId = stringValue(raw.uniqueid);
  const type = lightDeviceType(profile, name, model);
  const capabilities = type === "windowCovering"
    ? ["open", "close", "stop", "setTargetPosition"]
    : ["turnOn", "turnOff", "toggle", ...(numberValue(rawState.bri) === undefined ? [] : ["setBrightness"] )];
  const seenAt = timestamp(raw.lastseen);
  return {
    id: deviceId(gatewayIdentity, "light", resourceId, uniqueId),
    source: "phoscon",
    sourceId: `light:${resourceId}`,
    type,
    presentationType: "auto",
    name,
    host: baseUrl,
    model,
    firmwareVersion: stringValue(raw.swversion),
    macAddress: resourceMac(uniqueId),
    profile,
    reachable: booleanValue(rawState.reachable) ?? true,
    state: lightState(rawState, type),
    capabilities,
    homekitEnabled: false,
    credentialMode: "none",
    passwordConfigured: false,
    lastSeen: seenAt,
    lastEvent: timestamp(rawState.lastupdated, seenAt)
  };
}

type SensorResource = {
  resourceId: string;
  raw: JsonRecord;
  profile: string;
  uniqueId: string;
};

function sensorTypePriority(type: DeviceType): number {
  const order: DeviceType[] = [
    "waterLeakSensor", "smokeSensor", "motionSensor", "contactSensor", "energyMeter",
    "temperatureSensor", "humiditySensor", "lightSensor", "button", "genericSensor"
  ];
  const index = order.indexOf(type);
  return index < 0 ? order.length : index;
}

function latestTimestamp(values: string[], fallback: string): string {
  let best = Number.NEGATIVE_INFINITY;
  let result: string | undefined;
  for (const value of values) {
    const time = new Date(value).getTime();
    if (Number.isFinite(time) && time > best) { best = time; result = value; }
  }
  return result ?? fallback;
}

function mappedSensorGroup(baseUrl: string, gatewayIdentity: string, groupKey: string, resources: SensorResource[]): Device | undefined {
  if (!resources.length) return undefined;
  const sorted = [...resources].sort((left, right) =>
    sensorTypePriority(sensorDeviceType(left.profile)) - sensorTypePriority(sensorDeviceType(right.profile))
  );
  const primary = sorted[0];
  if (!primary) return undefined;
  const state: DeviceState = {};
  const seenTimes: string[] = [];
  const eventTimes: string[] = [];
  const reachability: boolean[] = [];
  for (const resource of sorted) {
    const rawState = record(resource.raw.state);
    const rawConfig = record(resource.raw.config);
    Object.assign(state, sensorState(rawState, rawConfig));
    const resourceReachable = booleanValue(rawConfig.reachable);
    if (resourceReachable !== undefined) reachability.push(resourceReachable);
    seenTimes.push(timestamp(resource.raw.lastseen));
    eventTimes.push(timestamp(rawState.lastupdated));
  }
  const fallback = now();
  const lastSeen = latestTimestamp(seenTimes, fallback);
  const lastEvent = latestTimestamp(eventTimes, lastSeen);
  const name = sorted.map(resource => stringValue(resource.raw.name)).find(Boolean) ?? "Zigbee sensor";
  const model = sorted.map(resource => stringValue(resource.raw.modelid)).find(Boolean) ?? "Zigbee sensor";
  const firmwareVersion = sorted.map(resource => stringValue(resource.raw.swversion)).find(Boolean);
  const profiles = [...new Set(sorted.map(resource => resource.profile))];
  return {
    id: deviceId(gatewayIdentity, "sensor", groupKey, groupKey),
    source: "phoscon",
    sourceId: `sensor:${sorted.map(resource => resource.resourceId).join(",")}`,
    type: sensorDeviceType(primary.profile),
    presentationType: "auto",
    name,
    host: baseUrl,
    model,
    firmwareVersion,
    macAddress: resourceMac(primary.uniqueId),
    profile: profiles.join(" + "),
    reachable: reachability.length ? reachability.some(Boolean) : true,
    state,
    capabilities: [],
    homekitEnabled: false,
    credentialMode: "none",
    passwordConfigured: false,
    lastSeen,
    lastEvent
  };
}

export function phosconDevicesFromState(baseUrl: string, payload: unknown): Device[] {
  const root = record(payload);
  const lights = record(root.lights);
  const sensors = record(root.sensors);
  const gatewayIdentity = stringValue(record(root.config).bridgeid) ?? baseUrl;
  const devices: Device[] = [];
  for (const [resourceId, value] of Object.entries(lights)) {
    const device = mappedLight(baseUrl, gatewayIdentity, resourceId, value);
    if (device) devices.push(device);
  }
  const sensorGroups = new Map<string, SensorResource[]>();
  for (const [resourceId, value] of Object.entries(sensors)) {
    const raw = record(value);
    const profile = stringValue(raw.type) ?? "Sensor";
    const uniqueId = stringValue(raw.uniqueid);
    if (!uniqueId || !/^(ZHA|ZGP)/.test(profile)) continue;
    const groupKey = resourceMac(uniqueId) ?? uniqueId.split("-", 1)[0] ?? uniqueId;
    const group = sensorGroups.get(groupKey) ?? [];
    group.push({ resourceId, raw, profile, uniqueId });
    sensorGroups.set(groupKey, group);
  }
  const lightDevicesByMac = new Map<string, Device[]>();
  for (const device of devices) {
    if (!device.macAddress) continue;
    const matches = lightDevicesByMac.get(device.macAddress) ?? [];
    matches.push(device);
    lightDevicesByMac.set(device.macAddress, matches);
  }

  for (const [groupKey, resources] of sensorGroups) {
    const sensor = mappedSensorGroup(baseUrl, gatewayIdentity, groupKey, resources);
    if (!sensor) continue;
    const matchingLights = sensor.macAddress ? lightDevicesByMac.get(sensor.macAddress) ?? [] : [];
    if (matchingLights.length !== 1) {
      devices.push(sensor);
      continue;
    }

    // deCONZ often exposes metering and battery data as sensor resources beside one actuator.
    // Merge those resources into the single physical light or outlet instead of showing duplicates.
    const light = matchingLights[0];
    if (!light) continue;
    const index = devices.indexOf(light);
    devices[index] = {
      ...light,
      model: light.model ?? sensor.model,
      firmwareVersion: light.firmwareVersion ?? sensor.firmwareVersion,
      profile: [light.profile, sensor.profile].filter(Boolean).join(" + "),
      reachable: light.reachable || sensor.reachable,
      state: { ...light.state, ...sensor.state },
      lastSeen: latestTimestamp([light.lastSeen, sensor.lastSeen], light.lastSeen),
      lastEvent: latestTimestamp([light.lastEvent, sensor.lastEvent], light.lastEvent)
    };
  }
  return devices;
}

export function gatewayStatus(payload: unknown): PhosconGatewayStatus {
  const config = record(record(payload).config ?? payload);
  return {
    connected: true,
    name: stringValue(config.name),
    deviceName: stringValue(config.devicename),
    bridgeId: stringValue(config.bridgeid),
    apiVersion: stringValue(config.apiversion),
    softwareVersion: stringValue(config.swversion),
    firmwareVersion: stringValue(config.fwversion),
    zigbeeChannel: numberValue(config.zigbeechannel),
    rfConnected: booleanValue(config.rfconnected),
    lastSync: now()
  };
}
