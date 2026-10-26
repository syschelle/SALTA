import { createHash, pbkdf2Sync } from "node:crypto";
import { request as httpRequest, type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import { getFritzBoxPresenceConnection, getFritzBoxSmartHomeSettings, updateFritzBoxSmartHomeSettings, writeSystemLog } from "./db.js";
import type { Device, DeviceCommand, FritzBoxSmartHomeSettings, FritzBoxSmartHomeStatus } from "./types.js";
import type { DeviceRegistry } from "./registry.js";

const requestTimeoutMs = 10_000;
const pollIntervalMs = 30_000;
const zeroSid = "0000000000000000";

type JsonRecord = Record<string, unknown>;
type SmartHomeDevice = JsonRecord & {
  UID?: string;
  ain?: string;
  name?: string;
  productName?: string;
  productCategory?: string;
  firmwareVersion?: string;
  isConnected?: boolean;
  batteryValue?: number;
  isBatteryLow?: boolean;
};
type SmartHomeUnit = JsonRecord & {
  UID?: string;
  ain?: string;
  name?: string;
  unitType?: string;
  deviceUid?: string;
  parentUid?: string;
  isConnected?: boolean;
  interfaces?: JsonRecord;
};
type SmartHomeOverview = { devices?: SmartHomeDevice[]; units?: SmartHomeUnit[] };
type HttpResponse = { status: number; headers: IncomingHttpHeaders; text: string };
type RequestFunction = (url: string, method: string, headers: Record<string,string>, body: string | undefined, tlsInsecure: boolean) => Promise<HttpResponse>;

type AdapterDependencies = {
  loadSettings?: () => Promise<FritzBoxSmartHomeSettings>;
  loadConnection?: typeof getFritzBoxPresenceConnection;
  updateSettings?: typeof updateFritzBoxSmartHomeSettings;
  request?: RequestFunction;
  log?: typeof writeSystemLog;
};

function now(): string { return new Date().toISOString(); }
function record(value: unknown): JsonRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}; }
function numberValue(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function booleanValue(value: unknown): boolean | undefined { return typeof value === "boolean" ? value : undefined; }
function stringValue(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function xmlValue(xml: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i").exec(xml)?.[1]?.trim();
}
function validSid(value: string | undefined): value is string { return Boolean(value && /^[0-9a-f]{16}$/i.test(value) && value !== zeroSid); }

export function fritzBoxWebOrigin(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("FRITZBOX_SMARTHOME_URL_INVALID");
  parsed.username = "";
  parsed.password = "";
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  if ((parsed.protocol === "http:" && parsed.port === "49000") || (parsed.protocol === "https:" && parsed.port === "49443")) parsed.port = "";
  return parsed.toString().replace(/\/$/, "");
}

function legacyPassword(value: string): string {
  return [...value].map(character => character.codePointAt(0)! > 255 ? "." : character).join("");
}

export function fritzBoxSidResponse(challenge: string, password: string): string {
  if (challenge.startsWith("2$")) {
    const parts = challenge.split("$");
    if (parts.length !== 5) throw new Error("FRITZBOX_SMARTHOME_AUTH_CHALLENGE");
    const iteration1 = Number.parseInt(parts[1]!, 10);
    const salt1 = Buffer.from(parts[2]!, "hex");
    const iteration2 = Number.parseInt(parts[3]!, 10);
    const salt2 = Buffer.from(parts[4]!, "hex");
    if (!Number.isSafeInteger(iteration1) || iteration1 <= 0 || !Number.isSafeInteger(iteration2) || iteration2 <= 0 || !salt1.length || !salt2.length) throw new Error("FRITZBOX_SMARTHOME_AUTH_CHALLENGE");
    const hash1 = pbkdf2Sync(Buffer.from(password, "utf8"), salt1, iteration1, 32, "sha256");
    const hash2 = pbkdf2Sync(hash1, salt2, iteration2, 32, "sha256");
    return `${parts[4]}$${hash2.toString("hex")}`;
  }
  const response = `${challenge}-${legacyPassword(password)}`;
  return `${challenge}-${createHash("md5").update(Buffer.from(response, "utf16le")).digest("hex")}`;
}

async function requestHttp(url: string, method: string, headers: Record<string,string>, body: string | undefined, tlsInsecure: boolean): Promise<HttpResponse> {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    let settled = false;
    const requestHeaders = { ...headers, ...(body === undefined ? {} : { "content-length": String(Buffer.byteLength(body, "utf8")) }), connection: "close", "user-agent": "SALTA FRITZ Smart Home Client" };
    const onResponse = (response: IncomingMessage) => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ status: response.statusCode ?? 0, headers: response.headers, text: Buffer.concat(chunks).toString("utf8") });
      });
    };
    const request = target.protocol === "https:"
      ? httpsRequest(target, { method, headers: requestHeaders, rejectUnauthorized: !tlsInsecure }, onResponse)
      : httpRequest(target, { method, headers: requestHeaders }, onResponse);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      request.destroy();
      reject(new Error("FRITZBOX_SMARTHOME_TIMEOUT"));
    }, requestTimeoutMs);
    request.on("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error("FRITZBOX_SMARTHOME_UNREACHABLE"));
    });
    if (body !== undefined) request.write(body);
    request.end();
  });
}

async function login(origin: string, username: string, password: string, tlsInsecure: boolean, request: RequestFunction): Promise<string> {
  const initial = await request(`${origin}/login_sid.lua?version=2`, "GET", { accept: "application/xml,text/xml" }, undefined, tlsInsecure);
  if (initial.status < 200 || initial.status >= 300) throw new Error(`FRITZBOX_SMARTHOME_LOGIN_HTTP_${initial.status}`);
  const existingSid = xmlValue(initial.text, "SID");
  if (validSid(existingSid)) return existingSid;
  const blockTime = Number.parseInt(xmlValue(initial.text, "BlockTime") ?? "0", 10);
  if (Number.isFinite(blockTime) && blockTime > 0) throw new Error("FRITZBOX_SMARTHOME_LOGIN_BLOCKED");
  const challenge = xmlValue(initial.text, "Challenge");
  if (!challenge) throw new Error("FRITZBOX_SMARTHOME_AUTH_CHALLENGE");
  const form = new URLSearchParams({ username, response: fritzBoxSidResponse(challenge, password) }).toString();
  const authenticated = await request(`${origin}/login_sid.lua?version=2`, "POST", { accept: "application/xml,text/xml", "content-type": "application/x-www-form-urlencoded" }, form, tlsInsecure);
  if (authenticated.status < 200 || authenticated.status >= 300) throw new Error(`FRITZBOX_SMARTHOME_LOGIN_HTTP_${authenticated.status}`);
  const sid = xmlValue(authenticated.text, "SID");
  if (!validSid(sid)) throw new Error("FRITZBOX_SMARTHOME_AUTHENTICATION_FAILED");
  return sid;
}

function interfaceRecord(unit: SmartHomeUnit, name: string): JsonRecord {
  return record(record(unit.interfaces)[name]);
}
function parentDevice(unit: SmartHomeUnit, devices: SmartHomeDevice[]): SmartHomeDevice | undefined {
  const uid = stringValue(unit.deviceUid) ?? stringValue(unit.parentUid);
  return uid ? devices.find(device => stringValue(device.UID) === uid) : undefined;
}
function stableDeviceId(unitUid: string): string {
  return `fritzbox:${createHash("sha256").update(unitUid).digest("hex").slice(0, 24)}`;
}
function unitCategory(unit: SmartHomeUnit): "thermostat" | "light" | "outlet" | "sensor" | undefined {
  const interfaces = record(unit.interfaces);
  if (Object.hasOwn(interfaces, "thermostatInterface")) return "thermostat";
  if (Object.hasOwn(interfaces, "onOffInterface")) {
    const unitType = (stringValue(unit.unitType) ?? "").toLowerCase();
    if (Object.hasOwn(interfaces, "colorControlInterface") || unitType.includes("bulb") || unitType.includes("light")) return "light";
    return "outlet";
  }
  if (Object.hasOwn(interfaces, "temperatureInterface") || Object.hasOwn(interfaces, "humidityInterface")) return "sensor";
  return undefined;
}
function categoryEnabled(category: ReturnType<typeof unitCategory>, settings: FritzBoxSmartHomeSettings): boolean {
  if (category === "thermostat") return settings.thermostats;
  if (category === "light") return settings.lights;
  if (category === "outlet") return settings.outlets;
  if (category === "sensor") return settings.sensors;
  return false;
}

export function mapFritzBoxSmartHomeOverview(overview: SmartHomeOverview, settings: FritzBoxSmartHomeSettings, stamp = now()): Device[] {
  if (!settings.enabled) return [];
  const devices = Array.isArray(overview.devices) ? overview.devices : [];
  const units = Array.isArray(overview.units) ? overview.units : [];
  const mapped: Device[] = [];
  for (const unit of units) {
    const unitUid = stringValue(unit.UID) ?? stringValue(unit.ain);
    if (!unitUid) continue;
    const parent = parentDevice(unit, devices);
    const category = unitCategory(unit);
    if (!categoryEnabled(category, settings)) continue;
    const temperature = numberValue(interfaceRecord(unit, "temperatureInterface").celsius);
    const humidity = numberValue(interfaceRecord(unit, "humidityInterface").relativeHumidity);
    const onOff = booleanValue(interfaceRecord(unit, "onOffInterface").active);
    const brightness = numberValue(interfaceRecord(unit, "levelControlInterface").level);
    const thermostat = interfaceRecord(unit, "thermostatInterface");
    const setPoint = record(thermostat.setPointTemperature);
    const targetTemperature = stringValue(setPoint.mode) === "temperature" ? numberValue(setPoint.celsius) : undefined;
    const battery = numberValue(parent?.batteryValue);
    const lowBattery = booleanValue(parent?.isBatteryLow);
    const reachable = booleanValue(unit.isConnected) ?? booleanValue(parent?.isConnected) ?? true;
    const productCategory = stringValue(parent?.productCategory);
    const state: Device["state"] = {};
    if (temperature !== undefined) state.temperature = temperature;
    if (humidity !== undefined) state.humidity = humidity;
    if (onOff !== undefined) state.on = onOff;
    if (brightness !== undefined) state.brightness = brightness;
    if (targetTemperature !== undefined) state.targetTemperature = targetTemperature;
    if (battery !== undefined) state.battery = battery;
    if (lowBattery !== undefined) state.lowBattery = lowBattery;
    if (category === "thermostat") state.mode = stringValue(setPoint.mode) ?? "unknown";
    const capabilities: string[] = [];
    let type: Device["type"];
    if (category === "thermostat") { type = "thermostat"; capabilities.push("setTargetTemperature"); }
    else if (category === "light") { type = "light"; capabilities.push("turnOn", "turnOff", "toggle"); if (brightness !== undefined) capabilities.push("setBrightness"); }
    else if (category === "outlet") { type = productCategory === "socket" ? "outlet" : "switch"; capabilities.push("turnOn", "turnOff", "toggle"); }
    else if (temperature !== undefined && humidity === undefined) type = "temperatureSensor";
    else if (humidity !== undefined && temperature === undefined) type = "humiditySensor";
    else type = "genericSensor";
    mapped.push({
      id: stableDeviceId(unitUid),
      source: "fritzbox",
      sourceId: unitUid,
      type,
      name: stringValue(unit.name) ?? stringValue(parent?.name) ?? stringValue(parent?.productName) ?? `FRITZ! ${unitUid}`,
      model: stringValue(parent?.productName),
      firmwareVersion: stringValue(parent?.firmwareVersion),
      reachable,
      state,
      capabilities,
      homekitEnabled: false,
      hidden: false,
      favorite: false,
      credentialMode: "inherit",
      passwordConfigured: false,
      lastSeen: stamp,
      lastEvent: stamp,
      adapterData: {
        unitUid,
        deviceUid: stringValue(unit.deviceUid) ?? stringValue(unit.parentUid) ?? "",
        productCategory: productCategory ?? "",
        unitType: stringValue(unit.unitType) ?? "",
        api: "smart-home-rest-v0"
      }
    });
  }
  return mapped;
}

export class FritzBoxSmartHomeAdapter {
  private timer?: NodeJS.Timeout;
  private running = false;
  private reconcileTask?: Promise<void>;
  private sid = "";
  private statusValue: FritzBoxSmartHomeStatus = { enabled: false, connected: false, deviceCount: 0 };
  private readonly loadSettings: () => Promise<FritzBoxSmartHomeSettings>;
  private readonly loadConnection: typeof getFritzBoxPresenceConnection;
  private readonly saveSettings: typeof updateFritzBoxSmartHomeSettings;
  private readonly request: RequestFunction;
  private readonly log: typeof writeSystemLog;

  constructor(private readonly registry: DeviceRegistry, dependencies: AdapterDependencies = {}) {
    this.loadSettings = dependencies.loadSettings ?? getFritzBoxSmartHomeSettings;
    this.loadConnection = dependencies.loadConnection ?? getFritzBoxPresenceConnection;
    this.saveSettings = dependencies.updateSettings ?? updateFritzBoxSmartHomeSettings;
    this.request = dependencies.request ?? requestHttp;
    this.log = dependencies.log ?? writeSystemLog;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.reconcile();
    this.timer = setInterval(() => void this.reconcile(), pollIntervalMs);
    this.timer.unref?.();
  }
  stop(): void { this.running = false; if (this.timer) clearInterval(this.timer); this.timer = undefined; this.sid = ""; }
  status(): FritzBoxSmartHomeStatus { return { ...this.statusValue }; }
  async settings(): Promise<FritzBoxSmartHomeSettings> { return this.loadSettings(); }

  async updateSettings(settings: FritzBoxSmartHomeSettings): Promise<FritzBoxSmartHomeSettings> {
    const updated = await this.saveSettings(settings);
    this.sid = "";
    if (!updated.enabled) this.statusValue = { enabled: false, connected: false, deviceCount: this.registry.all().filter(device => device.source === "fritzbox").length };
    else await this.reconcile();
    return updated;
  }

  private async connection(): Promise<{ origin: string; username: string; password: string; tlsInsecure: boolean }> {
    const connection = await this.loadConnection();
    return { origin: fritzBoxWebOrigin(connection.baseUrl), username: connection.username, password: connection.password, tlsInsecure: connection.tlsInsecure };
  }

  private async apiRequest(path: string, method = "GET", body?: unknown, retry = true): Promise<unknown> {
    const connection = await this.connection();
    if (!this.sid) this.sid = await login(connection.origin, connection.username, connection.password, connection.tlsInsecure, this.request);
    const textBody = body === undefined ? undefined : JSON.stringify(body);
    const response = await this.request(`${connection.origin}/api/v0${path}`, method, {
      accept: "application/json",
      authorization: `AVM-SID ${this.sid}`,
      ...(textBody === undefined ? {} : { "content-type": "application/json" })
    }, textBody, connection.tlsInsecure);
    if ((response.status === 401 || response.status === 403) && retry) { this.sid = ""; return this.apiRequest(path, method, body, false); }
    if (response.status < 200 || response.status >= 300) throw new Error(`FRITZBOX_SMARTHOME_HTTP_${response.status}`);
    if (!response.text.trim()) return undefined;
    let parsed: unknown;
    try { parsed = JSON.parse(response.text); } catch { throw new Error("FRITZBOX_SMARTHOME_RESPONSE_INVALID"); }
    const errors = Array.isArray(record(parsed).errors) ? record(parsed).errors as unknown[] : [];
    if (errors.length) throw new Error(`FRITZBOX_SMARTHOME_API_ERROR:${JSON.stringify(errors).slice(0, 400)}`);
    return parsed;
  }

  async testConnection(): Promise<FritzBoxSmartHomeStatus> {
    const settings = await this.loadSettings();
    if (!settings.enabled) return { enabled: false, connected: false, deviceCount: this.registry.all().filter(device => device.source === "fritzbox").length };
    try {
      const overview = record(await this.apiRequest("/smarthome/overview")) as SmartHomeOverview;
      const count = mapFritzBoxSmartHomeOverview(overview, settings).length;
      return { enabled: true, connected: true, deviceCount: count, lastSync: now(), api: "rest-v0" };
    } catch (error) {
      return { enabled: true, connected: false, deviceCount: 0, lastError: error instanceof Error ? error.message : String(error), api: "rest-v0" };
    }
  }

  async reconcile(): Promise<void> {
    if (this.reconcileTask) return this.reconcileTask;
    this.reconcileTask = this.reconcileInner().finally(() => { this.reconcileTask = undefined; });
    return this.reconcileTask;
  }

  private async reconcileInner(): Promise<void> {
    const settings = await this.loadSettings();
    if (!settings.enabled) {
      this.statusValue = { enabled: false, connected: false, deviceCount: this.registry.all().filter(device => device.source === "fritzbox").length };
      return;
    }
    try {
      const overview = record(await this.apiRequest("/smarthome/overview")) as SmartHomeOverview;
      const mapped = mapFritzBoxSmartHomeOverview(overview, settings);
      for (const device of mapped) await this.registry.set(device);
      this.statusValue = { enabled: true, connected: true, deviceCount: mapped.length, lastSync: now(), api: "rest-v0" };
      await this.log("info", "fritzbox-smarthome", "FRITZBOX_SMARTHOME_SYNC", "FRITZ!Box Smart Home synchronized", { devices: mapped.length, api: "rest-v0" }).catch(() => undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.statusValue = { enabled: true, connected: false, deviceCount: this.registry.all().filter(device => device.source === "fritzbox").length, lastError: message, api: "rest-v0" };
      await this.log("warning", "fritzbox-smarthome", "FRITZBOX_SMARTHOME_SYNC_FAILED", "FRITZ!Box Smart Home synchronization failed", { error: message }).catch(() => undefined);
    }
  }

  async command(command: DeviceCommand): Promise<Device> {
    const device = this.registry.get(command.deviceId);
    if (!device || device.source !== "fritzbox") throw new Error("DEVICE_NOT_FOUND");
    const unitUid = stringValue(device.adapterData?.unitUid) ?? device.sourceId;
    let body: unknown;
    if (command.capability === "setTargetTemperature") {
      const value = Number(command.value);
      if (!Number.isFinite(value) || value < 4 || value > 35) throw new Error("INVALID_TARGET_TEMPERATURE");
      body = { interfaces: { thermostatInterface: { setPointTemperature: { mode: "temperature", celsius: value } } } };
    } else if (["turnOn", "turnOff", "toggle"].includes(command.capability)) {
      const current = device.state.on === true;
      const active = command.capability === "toggle" ? !current : command.capability === "turnOn";
      body = { interfaces: { onOffInterface: { active } } };
    } else if (command.capability === "setBrightness") {
      const value = Number(command.value);
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("INVALID_BRIGHTNESS");
      body = { interfaces: { levelControlInterface: { level: Math.round(value) } } };
    } else throw new Error("CAPABILITY_NOT_SUPPORTED");
    await this.apiRequest(`/smarthome/overview/units/${encodeURIComponent(unitUid)}`, "PUT", body);
    await this.reconcile();
    return this.registry.get(device.id) ?? device;
  }
}

const settingsSchema = z.object({
  enabled: z.boolean().default(false),
  thermostats: z.boolean().default(false),
  outlets: z.boolean().default(false),
  lights: z.boolean().default(false),
  sensors: z.boolean().default(false)
}).strict();

export function registerFritzBoxSmartHomeRoutes(app: FastifyInstance, adapter: FritzBoxSmartHomeAdapter): void {
  app.get("/api/fritzbox/smarthome", async () => ({ settings: await adapter.settings(), status: adapter.status() }));
  app.put<{Body:unknown}>("/api/fritzbox/smarthome/settings", { config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: "1 minute", groupId: "fritz-smarthome-settings" } } }, async (request, reply) => {
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST" });
    const settings = await adapter.updateSettings(parsed.data);
    return { settings, status: adapter.status() };
  });
  app.post("/api/fritzbox/smarthome/test", { config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: "1 minute", groupId: "fritz-smarthome-test" } } }, async () => adapter.testConnection());
  app.post("/api/fritzbox/smarthome/refresh", { config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: "1 minute", groupId: "fritz-smarthome-refresh" } } }, async () => { await adapter.reconcile(); return adapter.status(); });
}
