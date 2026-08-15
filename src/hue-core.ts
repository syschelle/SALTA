import https from "node:https";
import { hueHttpsRequestOptions } from "./hue-tls.js";
import type { Device, DeviceState, DeviceType } from "./types.js";

type JsonRecord = Record<string, unknown>;

const now = (): string => new Date().toISOString();

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function normalizeHueBaseUrl(input: string): string {
  const value = input.trim();
  if (!value) throw new Error("HUE_URL_REQUIRED");
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new Error("HUE_URL_INVALID");
  }
  if (!url.hostname || url.username || url.password || url.search || url.hash || (url.port && url.port !== "443")) throw new Error("HUE_URL_INVALID");
  url.protocol = "https:";
  url.port = url.port || "443";
  url.pathname = "/";
  return url.toString().replace(/\/$/, "");
}

interface HueRequestOptions {
  method?: "GET" | "POST" | "PUT";
  applicationKey?: string;
  body?: unknown;
  accept?: string;
  timeoutMs?: number;
  bridgeId?: string;
  allowBridgeDiscovery?: boolean;
}

export async function hueRequestJson(urlInput: string, options: HueRequestOptions = {}): Promise<unknown> {
  const url = new URL(urlInput);
  const method = options.method ?? "GET";
  const payload = options.body === undefined ? undefined : Buffer.from(JSON.stringify(options.body), "utf8");
  const headers: Record<string, string | number> = {
    Accept: options.accept ?? "application/json"
  };
  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = payload.length;
  }
  if (options.applicationKey) headers["hue-application-key"] = options.applicationKey;

  const tlsOptions = await hueHttpsRequestOptions(url.toString(), {
    bridgeId: options.bridgeId,
    allowBridgeDiscovery: options.allowBridgeDiscovery
  });

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      ...tlsOptions,
      method,
      headers
    }, response => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        const status = response.statusCode ?? 0;
        const text = Buffer.concat(chunks).toString("utf8");
        if (status < 200 || status >= 300) {
          reject(new Error(`HUE_HTTP_${status || "ERROR"}`));
          return;
        }
        if (!text.trim()) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(text) as unknown);
        } catch {
          reject(new Error("HUE_INVALID_RESPONSE"));
        }
      });
    });
    request.setTimeout(options.timeoutMs ?? 8_000, () => request.destroy(new Error("HUE_TIMEOUT")));
    request.on("error", error => {
      if (error instanceof Error && error.message === "HUE_TIMEOUT") { reject(error); return; }
      const code = String((error as NodeJS.ErrnoException)?.code ?? "");
      if (["SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(code)) {
        reject(new Error("HUE_TLS_CERTIFICATE"));
        return;
      }
      reject(new Error("HUE_UNREACHABLE"));
    });
    if (payload) request.write(payload);
    request.end();
  });
}

export function hueApplicationKeyFromPairing(payload: unknown): string {
  const rows = Array.isArray(payload) ? payload : [];
  const first = record(rows[0]);
  const error = record(first.error);
  const errorType = numberValue(error.type);
  if (errorType === 101) throw new Error("HUE_LINK_BUTTON_REQUIRED");
  if (Object.keys(error).length) throw new Error("HUE_PAIRING_FAILED");
  const username = stringValue(record(first.success).username);
  if (!username) throw new Error("HUE_PAIRING_FAILED");
  return username;
}

export interface HueBridgeInfo {
  connected: boolean;
  name?: string;
  bridgeId?: string;
  model?: string;
  softwareVersion?: string;
  apiVersion?: string;
  lastSync?: string;
  lastError?: string;
  realtimeConnected?: boolean;
  realtimeLastEvent?: string;
  realtimeLastError?: string;
}

export function hueBridgeInfo(payload: unknown): HueBridgeInfo {
  const config = record(payload);
  return {
    connected: true,
    name: stringValue(config.name),
    bridgeId: stringValue(config.bridgeid),
    model: stringValue(config.modelid),
    softwareVersion: stringValue(config.swversion),
    apiVersion: stringValue(config.apiversion),
    lastSync: now()
  };
}

function resourceData(payload: unknown): JsonRecord[] {
  const root = record(payload);
  return Array.isArray(root.data) ? root.data.map(record) : [];
}

function ownerId(resource: JsonRecord): string | undefined {
  return stringValue(record(resource.owner).rid);
}

function hueDeviceType(archetype: string | undefined, productName: string | undefined): DeviceType {
  const text = `${archetype ?? ""} ${productName ?? ""}`.toLowerCase();
  return text.includes("plug") || text.includes("outlet") ? "outlet" : "light";
}

function xyToHex(x: number, y: number, brightnessPercent = 100): string | undefined {
  if (!(x > 0) || !(y > 0) || x + y >= 1.1) return undefined;
  const z = 1 - x - y;
  const Y = Math.max(0.01, Math.min(1, brightnessPercent / 100));
  const X = (Y / y) * x;
  const Z = (Y / y) * z;
  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.01153;
  const gamma = (value: number) => value <= 0.0031308 ? 12.92 * value : (1.055 * Math.pow(value, 1 / 2.4)) - 0.055;
  r = Math.max(0, gamma(r)); g = Math.max(0, gamma(g)); b = Math.max(0, gamma(b));
  const max = Math.max(r, g, b, 1);
  const channel = (value: number) => Math.round((value / max) * 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function hexToHueXy(value: string): { x: number; y: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) throw new Error("INVALID_COLOR");
  const hex = match[1]!;
  const linear = (channel: number) => {
    const value = channel / 255;
    return value > 0.04045 ? Math.pow((value + 0.055) / 1.055, 2.400000095) : value / 12.92;
  };
  const r = linear(parseInt(hex.slice(0, 2), 16));
  const g = linear(parseInt(hex.slice(2, 4), 16));
  const b = linear(parseInt(hex.slice(4, 6), 16));
  const X = r * 0.664511 + g * 0.154324 + b * 0.162028;
  const Y = r * 0.283881 + g * 0.668433 + b * 0.047685;
  const Z = r * 0.000088 + g * 0.07231 + b * 0.986039;
  const sum = X + Y + Z;
  if (!(sum > 0)) return { x: 0.3127, y: 0.329 };
  return { x: Number((X / sum).toFixed(4)), y: Number((Y / sum).toFixed(4)) };
}

export function hueDevicesFromResources(baseUrl: string, bridgeId: string, payload: unknown): Device[] {
  const resources = resourceData(payload);
  const devices = new Map<string, JsonRecord>();
  const connectivity = new Map<string, JsonRecord>();
  for (const resource of resources) {
    const type = stringValue(resource.type);
    const id = stringValue(resource.id);
    if (!id) continue;
    if (type === "device") devices.set(id, resource);
    if (type === "zigbee_connectivity") {
      const owner = ownerId(resource);
      if (owner) connectivity.set(owner, resource);
    }
  }

  const mapped: Device[] = [];
  for (const resource of resources) {
    if (stringValue(resource.type) !== "light") continue;
    const resourceId = stringValue(resource.id);
    const deviceId = ownerId(resource);
    if (!resourceId || !deviceId) continue;
    const owner = devices.get(deviceId) ?? {};
    const metadata = record(owner.metadata);
    const product = record(owner.product_data);
    const archetype = stringValue(metadata.archetype) ?? stringValue(product.product_archetype);
    const productName = stringValue(product.product_name);
    const type = hueDeviceType(archetype, productName);
    const on = booleanValue(record(resource.on).on);
    const brightness = numberValue(record(resource.dimming).brightness);
    const mirek = numberValue(record(resource.color_temperature).mirek);
    const schema = record(record(resource.color_temperature).mirek_schema);
    const minMirek = numberValue(schema.mirek_minimum);
    const maxMirek = numberValue(schema.mirek_maximum);
    const xy = record(record(resource.color).xy);
    const x = numberValue(xy.x);
    const y = numberValue(xy.y);
    const status = stringValue(connectivity.get(deviceId)?.status);
    const state: DeviceState = {};
    if (on !== undefined) state.on = on;
    if (brightness !== undefined) state.brightness = Math.max(0, Math.min(100, brightness));
    if (mirek !== undefined) {
      state.colorTemperature = mirek;
      if (mirek > 0) state.colorTemperatureKelvin = Math.round(1_000_000 / mirek);
    }
    if (x !== undefined && y !== undefined) {
      state.colorX = x;
      state.colorY = y;
      const colorHex = xyToHex(x, y, brightness ?? 100);
      if (colorHex) state.colorHex = colorHex;
    }
    const capabilities = ["turnOn", "turnOff", "toggle"];
    if (brightness !== undefined || Object.keys(record(resource.dimming)).length) capabilities.push("setBrightness");
    if (Object.keys(record(resource.color_temperature)).length) capabilities.push("setColorTemperature");
    if (Object.keys(record(resource.color)).length) capabilities.push("setColor");
    const timestamp = now();
    mapped.push({
      id: `hue:${bridgeId || "bridge"}:light:${resourceId}`,
      source: "hue",
      sourceId: `light:${resourceId}`,
      type,
      presentationType: "auto",
      name: stringValue(metadata.name) ?? productName ?? `Hue ${type}`,
      host: baseUrl,
      model: stringValue(product.model_id) ?? productName ?? "Philips Hue",
      firmwareVersion: stringValue(owner.software_version),
      profile: archetype ?? "hue-light",
      reachable: status ? status === "connected" : true,
      state,
      capabilities,
      homekitEnabled: false,
      hidden: false,
      credentialMode: "none",
      passwordConfigured: false,
      lastSeen: timestamp,
      lastEvent: timestamp,
      adapterData: {
        hueResourceId: resourceId,
        hueOwnerDeviceId: deviceId,
        ...(archetype ? { hueArchetype: archetype } : {}),
        ...(minMirek !== undefined ? { colorTemperatureMinMirek: minMirek } : {}),
        ...(maxMirek !== undefined ? { colorTemperatureMaxMirek: maxMirek } : {})
      }
    });
  }
  return mapped;
}
