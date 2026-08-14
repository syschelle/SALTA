import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { z } from "zod";
import type { DeviceRegistry } from "./registry.js";
import type { ShellyAdapter } from "./shelly-adapter.js";
import type { PhosconAdapter } from "./phoscon-adapter.js";
import { openCcuErrorInfo, type OpenCcuAdapter } from "./openccu-adapter.js";
import type { VirtualDeviceAdapter } from "./virtual-adapter.js";
import { normalizeFritzBoxBaseUrl, normalizePresenceMac, type FritzBoxPresenceAdapter } from "./fritzbox-presence.js";
import type { DeviceCommandRouter } from "./device-command-router.js";
import type { AutomationEngine } from "./automations.js";
import type { ClimateModeManager } from "./climate-mode.js";
import type { BatteryMonitor } from "./battery-monitor.js";
import type { HomeKitBridge } from "./homekit.js";
import { clearSystemLogs, createPresenceTarget, createRoom, deletePresenceTarget, deleteRoom, getFritzBoxPresenceConnection, getFritzBoxPresenceSettings, getGeneralSettings, getGlobalShellyCredentials, getOpenCcuSettings, getPhosconSettings, getPushoverSettings, getShellySettings, inspectCredentialEncryption, listPresenceTargets, listRooms, listSystemLogs, pool, reorderRooms, updateFritzBoxPresenceSettings, updateGeneralSettings, updatePresenceTarget, updatePushoverSettings, updateRoom, updateShellySettings, writeSystemLog } from "./db.js";
import { config } from "./config.js";
import { isHomeKitSupportedDevice, supportsPresentationOverride } from "./device-presentation.js";
import { clearSessionCookie, createSessionCookie, isIpInNetworks, safeEqual, SecurityManager, type AuthenticatedSession, type AuthMethod } from "./security.js";
import { createDisasterRecoveryBackup, importDisasterRecoveryBackup } from "./disaster-recovery-backup.js";

const commandSchema = z.object({ capability: z.string().min(1).max(80), value: z.union([z.string(), z.number(), z.boolean()]).optional() });
const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  roomId: z.string().uuid().nullable().optional(),
  homekitEnabled: z.boolean().optional(),
  homekitName: z.string().trim().max(120).nullable().optional(),
  homekitUseSaltaRoom: z.boolean().optional(),
  homekitRoomId: z.string().uuid().nullable().optional(),
  hidden: z.boolean().optional(),
  presentationType: z.enum(["auto", "outlet", "switch", "light", "fan"]).optional()
}).strict();
const credentialSchema = z.object({
  credentialMode: z.enum(["inherit","custom","none"]),
  username: z.string().max(120).optional(),
  password: z.string().max(512).optional()
}).strict();
const roomSchema = z.object({ name: z.string().trim().min(1).max(80), icon: z.string().trim().min(1).max(40).default("home"), sortOrder: z.number().int().min(0).max(10000).default(0) }).strict();
const roomOrderSchema = z.object({ roomIds: z.array(z.string().uuid()).max(10000) }).strict();
const shellyAddSchema = z.object({ host:z.string().trim().min(1).max(255), name:z.string().trim().max(120).optional(), roomId:z.string().uuid().nullable().optional(), credentialMode:z.enum(["inherit","custom","none"]).default("inherit"), username:z.string().max(120).optional(), password:z.string().max(512).optional() }).strict();
const shellyDiscoverySchema = z.object({ subnet:z.string().trim().min(7).max(32) }).strict();
const shellySettingsSchema = z.object({ username: z.string().max(120).default(""), password: z.string().max(512).optional() }).strict();
const phosconSettingsSchema = z.object({ baseUrl: z.string().trim().min(1).max(512), apiKey: z.string().trim().min(1).max(512).optional() }).strict();
const phosconPairSchema = z.object({ baseUrl: z.string().trim().min(1).max(512) }).strict();
const openCcuSettingsSchema = z.object({ baseUrl: z.string().trim().min(1).max(512), username: z.string().trim().min(1).max(120), password: z.string().max(512).optional() }).strict();
const fritzBoxPresenceSettingsSchema = z.object({
  baseUrl: z.string().trim().min(1).max(512),
  username: z.string().trim().max(120).default(""),
  password: z.string().max(512).optional(),
  enabled: z.boolean().default(false),
  pollIntervalSeconds: z.number().int().min(10).max(3600).default(30),
  absenceDelaySeconds: z.number().int().min(0).max(86400).default(300),
  tlsInsecure: z.boolean().default(false)
}).strict();
const fritzBoxPresenceTestSchema = z.object({ baseUrl: z.string().trim().min(1).max(512), username: z.string().trim().max(120).default(""), password: z.string().max(512).optional(), tlsInsecure: z.boolean().default(false) }).strict();
const presenceTargetSchema = z.object({ name: z.string().trim().min(1).max(120), macAddress: z.string().trim().min(12).max(32), absenceDelaySeconds: z.number().int().min(0).max(86400).nullable().optional() }).strict();
const openCcuDiagnosticSchema = z.object({ baseUrl: z.string().trim().min(1).max(512).optional(), username: z.string().trim().min(1).max(120).optional(), password: z.string().max(512).optional() }).strict();
const virtualDeviceSchema = z.object({ name: z.string().trim().min(1).max(120), type: z.literal("switch").default("switch"), roomId: z.string().uuid().nullable().optional() }).strict();
const automationAdditionalTriggerSchema = z.object({
  deviceId: z.string().min(1).max(255),
  stateKey: z.string().trim().min(1).max(80),
  value: z.boolean()
}).strict();
const automationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  enabled: z.boolean().default(true),
  roomId: z.string().uuid().nullable().optional(),
  triggerDeviceId: z.string().min(1).max(255),
  triggerStateKey: z.string().trim().min(1).max(80),
  triggerValue: z.boolean(),
  additionalTriggers: z.array(automationAdditionalTriggerSchema).max(7).default([]),
  conditionDeviceId: z.string().min(1).max(255).nullable().optional(),
  conditionStateKey: z.string().trim().min(1).max(80).nullable().optional(),
  conditionValue: z.boolean().nullable().optional(),
  actionDeviceId: z.string().min(1).max(255),
  action: z.enum(["turnOn", "turnOff", "toggle"])
}).strict();
const automationEnabledSchema = z.object({ enabled: z.boolean() }).strict();
const systemLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  source: z.string().trim().min(1).max(80).optional(),
  level: z.enum(["info", "warning", "error"]).optional()
}).strict();
const loginSchema = z.object({ username: z.string().max(64), password: z.string().max(1024) }).strict();
const climateModeSchema = z.object({ mode: z.enum(["summer", "winter"]), winterMode: z.enum(["manual", "auto"]).optional() }).strict();
const climateModeSettingsSchema = z.object({ winterMode: z.enum(["manual", "auto"]) }).strict();
const generalSettingsSchema = z.object({ debugLevel: z.enum(["off", "errors", "verbose"]) }).strict();
const homeKitSettingsSchema = z.object({
  enabled: z.boolean(),
  name: z.string().trim().min(1).max(120),
  networkInterface: z.string().trim().max(64).default("")
}).strict();
const disasterRecoveryExportSchema = z.object({ password: z.string().min(12).max(256) }).strict();
const disasterRecoveryImportSchema = z.object({ password: z.string().min(12).max(256), backup: z.unknown() }).strict();
const pushoverSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  userKey: z.string().trim().max(120).optional(),
  apiToken: z.string().trim().max(120).optional(),
  batteryThreshold: z.number().int().min(1).max(100).default(20)
}).strict();


const STATIC_CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2"
};

async function sendPublicFile(reply: FastifyReply, publicDir: string, fileName: string) {
  const data = await readFile(join(publicDir, fileName));
  const contentType = STATIC_CONTENT_TYPES[extname(fileName)] ?? "application/octet-stream";
  reply.type(contentType);
  const immutableVendorAsset = fileName.startsWith("vendor/");
  reply.header("Cache-Control", immutableVendorAsset ? "public, max-age=31536000, immutable" : "no-store");
  return reply.send(data);
}


function shellyRequestError(error: unknown): { status: number; code: string; message: string } {
  const rawCode = error instanceof Error ? error.message : "SHELLY_REQUEST_FAILED";
  switch (rawCode) {
    case "AUTHENTICATION_FAILED":
      return { status: 422, code: rawCode, message: "Authentication failed. Check the selected Shelly credentials." };
    case "DEVICE_UNREACHABLE":
      return { status: 502, code: rawCode, message: "The Shelly device is unreachable at the specified address." };
    case "DETECTION_TIMEOUT":
      return { status: 504, code: rawCode, message: "Shelly device detection timed out." };
    case "INVALID_DEVICE_RESPONSE":
    case "UNSUPPORTED_SHELLY_DEVICE":
      return { status: 422, code: "UNSUPPORTED_DEVICE", message: "The device returned an unsupported response." };
    case "HTTP_404":
      return { status: 422, code: "UNSUPPORTED_DEVICE", message: "No supported Shelly API was detected at the specified address." };
    case "ENCRYPTION_KEY_MISMATCH":
      return { status: 409, code: rawCode, message: "Stored Shelly credentials cannot be decrypted with the current SALTA encryption key. Re-enter the credentials in Settings." };
    default:
      if (rawCode.startsWith("HTTP_")) return { status: 502, code: "SHELLY_HTTP_ERROR", message: `The Shelly device returned ${rawCode.replace("HTTP_", "HTTP ")}.` };
      return { status: 500, code: "DEVICE_ADD_FAILED", message: "The Shelly device could not be added to SALTA." };
  }
}


function phosconRequestError(error: unknown): { status: number; code: string; message: string } {
  const rawCode = error instanceof Error ? error.message : "PHOSCON_REQUEST_FAILED";
  switch (rawCode) {
    case "PHOSCON_URL_REQUIRED":
    case "PHOSCON_URL_INVALID":
      return { status: 400, code: rawCode, message: "Enter a valid Phoscon/deCONZ base URL, for example http://192.168.178.20:8080." };
    case "PHOSCON_API_KEY_REQUIRED":
      return { status: 400, code: rawCode, message: "Enter an API key or pair SALTA with the Phoscon gateway." };
    case "PHOSCON_NOT_CONFIGURED":
      return { status: 409, code: rawCode, message: "Connect a Phoscon/deCONZ gateway before synchronizing Zigbee devices." };
    case "PHOSCON_GATEWAY_LOCKED":
      return { status: 409, code: rawCode, message: "Unlock third-party app authentication in Phoscon and try pairing again within 60 seconds." };
    case "PHOSCON_AUTHENTICATION_FAILED":
      return { status: 422, code: rawCode, message: "The Phoscon API key was rejected by the gateway." };
    case "PHOSCON_UNREACHABLE":
      return { status: 502, code: rawCode, message: "The Phoscon/deCONZ gateway is unreachable at the configured address." };
    case "PHOSCON_TIMEOUT":
      return { status: 504, code: rawCode, message: "The Phoscon/deCONZ gateway did not respond in time." };
    case "PHOSCON_PAIRING_FAILED":
    case "PHOSCON_INVALID_RESPONSE":
      return { status: 502, code: rawCode, message: "The Phoscon/deCONZ gateway returned an invalid pairing or API response." };
    case "ENCRYPTION_KEY_MISMATCH":
      return { status: 409, code: rawCode, message: "The stored Phoscon API key cannot be decrypted with the current SALTA encryption key." };
    default:
      if (rawCode.startsWith("PHOSCON_API_ERROR:")) return { status: 502, code: "PHOSCON_API_ERROR", message: rawCode.slice("PHOSCON_API_ERROR:".length) };
      if (rawCode.startsWith("PHOSCON_HTTP_")) return { status: 502, code: "PHOSCON_HTTP_ERROR", message: `The Phoscon gateway returned ${rawCode.replace("PHOSCON_HTTP_", "HTTP ")}.` };
      return { status: 500, code: "PHOSCON_REQUEST_FAILED", message: "The Phoscon request failed." };
  }
}

function openCcuRequestError(error: unknown): { status: number; code: string; message: string; details?: Record<string, string> } {
  const info = openCcuErrorInfo(error);
  const rawCode = info.code;
  const details = Object.fromEntries(Object.entries({ method: info.method, remoteCode: info.remoteCode, remoteMessage: info.message }).filter(([, value]) => Boolean(value))) as Record<string, string>;
  const withDetails = (response: { status: number; code: string; message: string }) => Object.keys(details).length ? { ...response, details } : response;
  switch (rawCode) {
    case "OPENCCU_URL_REQUIRED":
    case "OPENCCU_URL_INVALID":
      return withDetails({ status: 400, code: rawCode, message: "Enter a valid OpenCCU base URL, for example http://192.168.178.30." });
    case "OPENCCU_CREDENTIALS_REQUIRED":
      return withDetails({ status: 400, code: rawCode, message: "Enter an OpenCCU username and password." });
    case "OPENCCU_NOT_CONFIGURED":
      return withDetails({ status: 409, code: rawCode, message: "Connect an OpenCCU instance before synchronizing HomeMatic devices." });
    case "OPENCCU_AUTHENTICATION_FAILED":
      return withDetails({ status: 422, code: rawCode, message: "OpenCCU rejected the configured username or password." });
    case "OPENCCU_AUTH_OR_SESSION_LIMIT":
      return withDetails({ status: 503, code: rawCode, message: "OpenCCU could not create a JSON-RPC session. The credentials may be invalid or the OpenCCU session limit may be exhausted." });
    case "OPENCCU_UNREACHABLE":
      return withDetails({ status: 502, code: rawCode, message: "The OpenCCU instance is unreachable at the configured address." });
    case "OPENCCU_TIMEOUT":
      return withDetails({ status: 504, code: rawCode, message: "The OpenCCU instance did not respond in time." });
    case "OPENCCU_TLS_ERROR":
      return withDetails({ status: 502, code: rawCode, message: "The OpenCCU HTTPS certificate could not be verified. Use a trusted certificate or HTTP inside a trusted local network." });
    case "OPENCCU_INVALID_RESPONSE":
      return withDetails({ status: 502, code: rawCode, message: "OpenCCU returned an invalid JSON-RPC response." });
    case "OPENCCU_CATALOG_UNAVAILABLE":
      return withDetails({ status: 502, code: rawCode, message: "OpenCCU did not return a usable device catalogue from any supported interface." });
    case "OPENCCU_CHANNELS_UNAVAILABLE":
      return withDetails({ status: 502, code: rawCode, message: "OpenCCU did not return channel values. SALTA will create a fresh session and retry automatically." });
    case "OPENCCU_DEVICE_METADATA_MISSING":
      return withDetails({ status: 409, code: rawCode, message: "The HomeMatic device is missing OpenCCU command metadata. Synchronize the adapter again." });
    case "ENCRYPTION_KEY_MISMATCH":
      return withDetails({ status: 409, code: rawCode, message: "The stored OpenCCU password cannot be decrypted with the current SALTA encryption key." });
    default:
      if (rawCode === "OPENCCU_API_ERROR") {
        const methodPrefix = info.method ? `${info.method}: ` : "";
        return withDetails({ status: 502, code: rawCode, message: `${methodPrefix}${info.message || "OpenCCU returned a JSON-RPC error."}` });
      }
      if (rawCode.startsWith("OPENCCU_HTTP_")) return withDetails({ status: 502, code: "OPENCCU_HTTP_ERROR", message: `OpenCCU returned ${rawCode.replace("OPENCCU_HTTP_", "HTTP ")}.` });
      return withDetails({ status: 500, code: "OPENCCU_REQUEST_FAILED", message: "The OpenCCU request failed." });
  }
}

interface RequestAuthContext {
  method: AuthMethod;
  local: boolean;
  session?: AuthenticatedSession;
  sessionToken?: string;
}

function requestPath(request: FastifyRequest): string {
  try { return new URL(request.raw.url ?? request.url, "http://salta.local").pathname; }
  catch { return request.url.split("?", 1)[0] ?? "/"; }
}

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function parseBasicCredentials(header: string | undefined): { username: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch { return null; }
}

function originMatchesRequest(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === request.host && parsed.protocol.replace(":", "") === request.protocol;
  } catch { return false; }
}

function securityError(reply: FastifyReply, request: FastifyRequest, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message, requestId: request.id } });
}

function automationError(error: unknown): { status: number; code: string; message: string } {
  const code = error instanceof Error ? error.message : "AUTOMATION_FAILED";
  const messages: Record<string, string> = {
    AUTOMATION_NOT_FOUND: "Automation not found.",
    AUTOMATION_NAME_REQUIRED: "Enter a name for the automation.",
    AUTOMATION_ROOM_NOT_FOUND: "The selected room does not exist.",
    AUTOMATION_TRIGGER_DEVICE_NOT_FOUND: "The trigger device no longer exists.",
    AUTOMATION_TRIGGER_STATE_UNSUPPORTED: "The selected trigger state is not available on this device.",
    AUTOMATION_TRIGGER_EVENT_UNSUPPORTED: "The selected trigger event is not available on this device.",
    AUTOMATION_TRIGGER_LIMIT: "An automation can use at most eight OR triggers.",
    AUTOMATION_TRIGGER_DUPLICATE: "The same trigger is configured more than once.",
    AUTOMATION_ACTION_DEVICE_NOT_FOUND: "The action device no longer exists.",
    AUTOMATION_TRIGGER_ACTION_SAME_DEVICE: "Trigger and action must use different devices.",
    AUTOMATION_ACTION_UNSUPPORTED: "The selected action is not supported by the target device.",
    AUTOMATION_CONDITION_DEVICE_NOT_FOUND: "The condition device no longer exists.",
    AUTOMATION_CONDITION_INVALID: "The condition is incomplete.",
    AUTOMATION_CONDITION_STATE_UNSUPPORTED: "The selected condition state is not available on this device.",
    AUTOMATION_CYCLE_NOT_ALLOWED: "This automation would create a device-action loop. Cyclic automations are not allowed."
  };
  return { status: code === "AUTOMATION_NOT_FOUND" ? 404 : code.endsWith("_NOT_FOUND") ? 404 : 400, code, message: messages[code] ?? "The automation could not be saved." };
}

function normalizeAutomationInput(data: z.infer<typeof automationSchema>) {
  return {
    name: data.name,
    enabled: data.enabled,
    roomId: data.roomId ?? undefined,
    triggerDeviceId: data.triggerDeviceId,
    triggerStateKey: data.triggerStateKey,
    triggerValue: data.triggerValue,
    additionalTriggers: data.additionalTriggers.map(trigger => ({ deviceId: trigger.deviceId, stateKey: trigger.stateKey, value: trigger.value })),
    conditionDeviceId: data.conditionDeviceId ?? undefined,
    conditionStateKey: data.conditionStateKey ?? undefined,
    conditionValue: data.conditionValue ?? undefined,
    actionDeviceId: data.actionDeviceId,
    action: data.action
  };
}

function fritzBoxRequestError(error: unknown): { status: number; code: string; message: string } {
  const code=error instanceof Error?error.message:"FRITZBOX_REQUEST_FAILED";
  if(code==="FRITZBOX_URL_INVALID") return {status:400,code,message:"Enter a valid FRITZ!Box TR-064 address using HTTP or HTTPS and port 49000 or 49443."};
  if(code==="FRITZBOX_TLS_CERTIFICATE") return {status:422,code,message:"The FRITZ!Box HTTPS certificate could not be verified. Enable the explicit certificate-check bypass only if you trust this local FRITZ!Box."};
  if(code==="PRESENCE_MAC_INVALID") return {status:400,code,message:"Enter a valid MAC address in the format AA:BB:CC:DD:EE:FF."};
  if(code==="FRITZBOX_AUTHENTICATION_REQUIRED") return {status:422,code,message:"The FRITZ!Box TR-064 Hosts service requires authentication. Enter a FRITZ!Box username and password."};
  if(code==="FRITZBOX_AUTHENTICATION_FAILED") return {status:422,code,message:"TR-064 is reachable, but the FRITZ!Box rejected the configured username or password."};
  if(code==="FRITZBOX_HTTP_411") return {status:502,code,message:"The FRITZ!Box rejected the TR-064 SOAP request with HTTP 411 (Length Required)."};
  if(code==="FRITZBOX_AUTHORIZATION_FAILED") return {status:403,code,message:"The FRITZ!Box user is authenticated but does not have the required TR-064 permissions."};
  if(code==="FRITZBOX_UNREACHABLE") return {status:502,code,message:"The FRITZ!Box TR-064 interface is unreachable."};
  if(code==="FRITZBOX_TIMEOUT") return {status:504,code,message:"The FRITZ!Box TR-064 interface did not respond in time."};
  if(code==="ENCRYPTION_KEY_MISMATCH") return {status:409,code,message:"The stored FRITZ!Box password cannot be decrypted with the current SALTA encryption key."};
  if(code.startsWith("FRITZBOX_SOAP_")||code.startsWith("FRITZBOX_HTTP_")||code==="FRITZBOX_INVALID_RESPONSE") return {status:502,code,message:"The FRITZ!Box returned an unexpected TR-064 response."};
  return {status:500,code:"FRITZBOX_REQUEST_FAILED",message:"The FRITZ!Box presence request failed."};
}

async function automationRoomExists(roomId: string | null | undefined): Promise<boolean> {
  if (!roomId) return true;
  return (await listRooms()).some(room => room.id === roomId);
}

export function buildServer(registry: DeviceRegistry, shellyAdapter: ShellyAdapter, phosconAdapter: PhosconAdapter, openCcuAdapter: OpenCcuAdapter, virtualAdapter?: VirtualDeviceAdapter, commandRouter?: DeviceCommandRouter, automationEngine?: AutomationEngine, presenceAdapter?: FritzBoxPresenceAdapter, climateMode?: ClimateModeManager, batteryMonitor?: BatteryMonitor, restartAfterConfigurationImport?: () => void, homeKitBridge?: HomeKitBridge) {
  const trustedProxyEntries = config.TRUSTED_PROXIES.split(",").map(value => value.trim()).filter(Boolean);
  const trustedProxies = trustedProxyEntries.length ? trustedProxyEntries : false;
  const localNetworks = config.LOCAL_NETWORKS.split(",").map(value => value.trim()).filter(Boolean);
  const security = new SecurityManager(config.SESSION_TTL_MINUTES * 60_000);
  const authContexts = new WeakMap<FastifyRequest, RequestAuthContext>();
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["x-salta-csrf"]',
        'req.headers["x-salta-health-token"]',
        'res.headers["set-cookie"]'
      ]
    },
    genReqId: () => randomUUID(),
    bodyLimit: 32 * 1024,
    connectionTimeout: 10_000,
    requestTimeout: 15_000,
    keepAliveTimeout: 5_000,
    maxRequestsPerSocket: 100,
    trustProxy: trustedProxies
  });
  app.server.maxHeadersCount = 64;
  app.server.headersTimeout = 10_000;

  const publicDir = join(process.cwd(), "public");
  const publicPaths = new Set(["/login", "/login.html", "/login.js", "/login.css", "/theme-init.js"]);
  const staticFiles = new Map<string, string>([
    ["/app.js", "app.js"],
    ["/automation-ui.js", "automation-ui.js"],
    ["/homekit-qr.js", "homekit-qr.js"],
    ["/room-grouping.js", "room-grouping.js"],
    ["/styles.css", "styles.css"],
    ["/theme-init.js", "theme-init.js"],
    ["/login.html", "login.html"],
    ["/login.js", "login.js"],
    ["/login.css", "login.css"],
    ["/vendor/mdi/materialdesignicons.min.css", "vendor/mdi/materialdesignicons.min.css"],
    ["/vendor/mdi/fonts/materialdesignicons-webfont.woff2", "vendor/mdi/fonts/materialdesignicons-webfont.woff2"]
  ]);
  const rateWindowMs = 60_000;

  void app.register(fastifyRateLimit, {
    global: false,
    max: config.RATE_LIMIT_PER_MINUTE,
    timeWindow: rateWindowMs,
    keyGenerator: request => request.ip,
    cache: 10_000,
    errorResponseBuilder: (request) => ({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Try again later.",
        requestId: request.id
      }
    })
  });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Cross-Origin-Resource-Policy", "same-origin");
    reply.header("Content-Security-Policy", "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; script-src-elem 'self'; script-src-attr 'unsafe-inline'");
    if (request.protocol === "https") reply.header("Strict-Transport-Security", "max-age=31536000");
    const path = requestPath(request);
    if (path.startsWith("/api/") || path.startsWith("/auth/") || path === "/" || path === "/login" || path.endsWith(".html")) {
      reply.header("Cache-Control", "no-store");
      reply.header("Vary", "Cookie");
    }
    return payload;
  });

  app.addHook("onRequest", async (request, reply) => {
    const path = requestPath(request);
    const ip = request.ip;
    const hasForwardedHeaders = Boolean(request.headers["x-forwarded-for"] || request.headers["x-forwarded-proto"] || request.headers["x-forwarded-host"]);
    if (!trustedProxies && hasForwardedHeaders) {
      request.log.error({ ip }, "Rejected proxy request because TRUSTED_PROXIES is not configured");
      return securityError(reply, request, 400, "TRUSTED_PROXY_REQUIRED", "Reverse-proxy headers were received but no trusted proxy is configured.");
    }

    if (path === "/internal/health") {
      const token = request.headers["x-salta-health-token"];
      if (typeof token !== "string" || !safeEqual(token, config.SALTA_HEALTH_TOKEN)) {
        request.log.warn({ ip }, "Rejected internal health request");
        return securityError(reply, request, 404, "NOT_FOUND", "Route not found");
      }
      return;
    }

    const globalLimit = security.consumeRateLimit("global", config.RATE_LIMIT_GLOBAL_PER_MINUTE, rateWindowMs);
    const clientLimit = security.consumeRateLimit(`client:${ip}`, config.RATE_LIMIT_PER_MINUTE, rateWindowMs);
    const mutationLimit = isUnsafeMethod(request.method)
      ? security.consumeRateLimit(`mutation:${ip}`, config.RATE_LIMIT_MUTATIONS_PER_MINUTE, rateWindowMs)
      : { allowed: true, retryAfterSeconds: 0, remaining: config.RATE_LIMIT_MUTATIONS_PER_MINUTE };
    const expensiveRouteLimit = path === "/api/adapters/shelly/discover"
      ? security.consumeRateLimit(`discover:${ip}`, 2, rateWindowMs)
      : path === "/api/adapters/shelly/reconcile" || path === "/api/adapters/phoscon/reconcile" || path === "/api/adapters/openccu/reconcile" || path === "/api/settings/openccu/diagnose" || path === "/api/presence/refresh" || path === "/api/presence/test"
        ? security.consumeRateLimit(`reconcile:${ip}`, 12, rateWindowMs)
        : (path === "/api/adapters/shelly/devices" || path === "/api/adapters/virtual/devices") && request.method === "POST"
          ? security.consumeRateLimit(`onboarding:${ip}`, 10, rateWindowMs)
          : path === "/api/settings/phoscon/pair" && request.method === "POST"
            ? security.consumeRateLimit(`phoscon-pairing:${ip}`, 5, rateWindowMs)
            : { allowed: true, retryAfterSeconds: 0, remaining: 1 };
    const blocked = !globalLimit.allowed
      ? globalLimit
      : !clientLimit.allowed
        ? clientLimit
        : !mutationLimit.allowed
          ? mutationLimit
          : !expensiveRouteLimit.allowed
            ? expensiveRouteLimit
            : null;
    if (blocked) {
      request.log.warn({ ip, path, method: request.method }, "Application rate limit exceeded");
      reply.header("Retry-After", String(blocked.retryAfterSeconds));
      return securityError(reply, request, 429, "RATE_LIMITED", "Too many requests. Try again later.");
    }

    if (path === "/auth/login" || publicPaths.has(path)) return;

    const local = isIpInNetworks(ip, localNetworks);
    const sessionResult = security.getSession(request.headers.cookie);
    if (sessionResult) {
      const context: RequestAuthContext = { method: "session", local, session: sessionResult.session, sessionToken: sessionResult.token };
      authContexts.set(request, context);
      if (path.startsWith("/api/") && !local) {
        const fetchSite = request.headers["sec-fetch-site"];
        if (typeof fetchSite === "string" && fetchSite !== "same-origin" && fetchSite !== "same-site") {
          return securityError(reply, request, 403, "REMOTE_API_DENIED", "Remote API requests must originate from the authenticated SALTA web application.");
        }
      }
      if (isUnsafeMethod(request.method)) {
        const csrfHeader = request.headers["x-salta-csrf"];
        if (typeof csrfHeader !== "string" || !safeEqual(csrfHeader, sessionResult.session.csrfToken)) {
          return securityError(reply, request, 403, "CSRF_VALIDATION_FAILED", "The request could not be verified.");
        }
        if (!local && !originMatchesRequest(request)) {
          return securityError(reply, request, 403, "ORIGIN_VALIDATION_FAILED", "The request origin is not allowed.");
        }
      }
      return;
    }

    const basic = parseBasicCredentials(request.headers.authorization);
    if (local && !hasForwardedHeaders && basic && safeEqual(basic.username, config.ADMIN_USERNAME) && safeEqual(basic.password, config.ADMIN_PASSWORD)) {
      authContexts.set(request, { method: "basic", local: true });
      return;
    }

    if (path.startsWith("/api/") || path.startsWith("/auth/")) {
      return securityError(reply, request, 401, "UNAUTHORIZED", "Authentication required");
    }
    return reply.redirect("/login");
  });

  app.get("/login", async (request, reply) => {
    if (security.getSession(request.headers.cookie)) return reply.redirect("/");
    return sendPublicFile(reply, publicDir, "login.html");
  });

  app.post<{ Body: unknown }>("/auth/login", {
    config: { rateLimit: { max: 20, timeWindow: rateWindowMs, groupId: "auth-login" } }
  }, async (request, reply) => {
    const ip = request.ip;
    const local = isIpInNetworks(ip, localNetworks);
    if (!local && !originMatchesRequest(request)) {
      request.log.warn({ ip }, "Rejected cross-origin login request");
      return securityError(reply, request, 403, "ORIGIN_VALIDATION_FAILED", "The request origin is not allowed.");
    }
    const allowed = security.loginAllowed(ip, config.LOGIN_MAX_ATTEMPTS, config.LOGIN_WINDOW_MINUTES * 60_000);
    if (!allowed.allowed) {
      request.log.warn({ ip }, "Blocked repeated login attempts");
      reply.header("Retry-After", String(allowed.retryAfterSeconds));
      return securityError(reply, request, 429, "LOGIN_RATE_LIMITED", "Too many failed login attempts. Try again later.");
    }
    const parsed = loginSchema.safeParse(request.body);
    const valid = parsed.success
      && safeEqual(parsed.data.username, config.ADMIN_USERNAME)
      && safeEqual(parsed.data.password, config.ADMIN_PASSWORD);
    if (!valid) {
      const state = security.recordLoginFailure(ip, config.LOGIN_MAX_ATTEMPTS, config.LOGIN_WINDOW_MINUTES * 60_000, config.LOGIN_BLOCK_MINUTES * 60_000);
      request.log.warn({ ip, failures: state.failures, blocked: state.blockedUntil > Date.now() }, "Failed SALTA login");
      return securityError(reply, request, 401, "INVALID_CREDENTIALS", "Invalid username or password");
    }
    security.clearLoginFailures(ip);
    const { token, session } = security.createSession(parsed.data.username);
    reply.header("Set-Cookie", createSessionCookie(token, config.SESSION_TTL_MINUTES * 60, request.protocol === "https"));
    request.log.info({ ip, username: parsed.data.username }, "SALTA login successful");
    return { status: "ok", csrfToken: session.csrfToken, expiresAt: new Date(session.expiresAt).toISOString() };
  });

  app.get("/auth/session", async (request, reply) => {
    const context = authContexts.get(request);
    if (!context?.session) return securityError(reply, request, 401, "SESSION_REQUIRED", "A browser session is required");
    return { username: context.session.username, csrfToken: context.session.csrfToken, expiresAt: new Date(context.session.expiresAt).toISOString() };
  });

  app.post("/auth/logout", async (request, reply) => {
    const context = authContexts.get(request);
    security.destroySession(context?.sessionToken);
    reply.header("Set-Cookie", clearSessionCookie(request.protocol === "https"));
    return reply.code(204).send();
  });

  app.get("/internal/health", async () => ({ status: "ok", name: "SALTA", version: "0.8.51" }));

  app.get("/api/health", async () => ({ status: "ok", name: "SALTA", version: "0.8.51", time: new Date().toISOString() }));
  app.get("/api/readiness", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "readiness" } }
  }, async (_request, reply) => {
    try {
      await pool.query("select 1");
      const credentialEncryption = await inspectCredentialEncryption();
      const components = {
        database: "up",
        shellyAdapter: "up",
        phosconAdapter: phosconAdapter.getStatus().connected ? "connected" : "disconnected",
        openCcuAdapter: openCcuAdapter.getStatus().connected ? "connected" : "disconnected",
        credentials: credentialEncryption.status,
        shellyCredential: credentialEncryption.globalCredential,
        phosconCredential: credentialEncryption.phosconCredential,
        openCcuCredential: credentialEncryption.openCcuCredential,
        invalidDeviceCredentials: credentialEncryption.invalidDeviceIds.length,
        devices: registry.all().length
      };
      if (credentialEncryption.status === "invalid") return reply.code(503).send({ status: "not-ready", components });
      return { status: "ready", components };
    } catch { return reply.code(503).send({ status: "not-ready", components: { database: "down" } }); }
  });

  app.get("/api/rooms", {
    config: { rateLimit: { max: 120, timeWindow: rateWindowMs, groupId: "rooms-read" } }
  }, async () => listRooms());
  app.post<{Body:unknown}>("/api/rooms", async (request,reply)=>{
    const parsed=roomSchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:{code:"INVALID_REQUEST",message:parsed.error.issues[0]?.message,requestId:request.id}});
    try { return reply.code(201).send(await createRoom(parsed.data.name,parsed.data.icon,parsed.data.sortOrder)); }
    catch { return reply.code(409).send({error:{code:"ROOM_EXISTS",message:"A room with this name already exists",requestId:request.id}}); }
  });
  app.put<{Body:unknown}>("/api/rooms/order",async(request,reply)=>{
    const parsed=roomOrderSchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:{code:"INVALID_REQUEST",message:parsed.error.issues[0]?.message,requestId:request.id}});
    try { return await reorderRooms(parsed.data.roomIds); }
    catch (error) {
      if (error instanceof Error && error.message === "INVALID_ROOM_ORDER") return reply.code(409).send({error:{code:"INVALID_ROOM_ORDER",message:"Room order does not match the current room list",requestId:request.id}});
      throw error;
    }
  });
  app.put<{Params:{id:string};Body:unknown}>("/api/rooms/:id",async(request,reply)=>{
    const parsed=roomSchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:{code:"INVALID_REQUEST",message:parsed.error.issues[0]?.message,requestId:request.id}});
    const room=await updateRoom(request.params.id,parsed.data.name,parsed.data.icon,parsed.data.sortOrder);
    if(!room) return reply.code(404).send({error:{code:"ROOM_NOT_FOUND",message:"Room not found",requestId:request.id}});
    registry.updateRoomName(room.id,room.name);
    return room;
  });
  app.delete<{Params:{id:string} }>("/api/rooms/:id",async(request,reply)=>{
    const deleted = await deleteRoom(request.params.id);
    if (!deleted) return reply.code(404).send({error:{code:"ROOM_NOT_FOUND",message:"Room not found",requestId:request.id}});
    registry.clearRoom(request.params.id);
    automationEngine?.clearRoomAssignment?.(request.params.id);
    return reply.code(204).send();
  });

  app.get("/api/presence", { config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "presence-read" } } }, async () => ({
    settings: await getFritzBoxPresenceSettings(),
    targets: await listPresenceTargets(),
    status: presenceAdapter?.getStatus() ?? { connected: false, enabled: false },
    devices: registry.all().filter(device => device.source === "presence")
  }));

  app.put<{Body:unknown}>("/api/presence/settings", { config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "presence-settings-write" } } }, async (request, reply) => {
    const parsed=fritzBoxPresenceSettingsSchema.safeParse(request.body); if(!parsed.success) return securityError(reply,request,400,"INVALID_REQUEST","Invalid presence settings.");
    try {
      const baseUrl=normalizeFritzBoxBaseUrl(parsed.data.baseUrl);
      const settings=await updateFritzBoxPresenceSettings({...parsed.data,baseUrl});
      if(presenceAdapter) await presenceAdapter.reload();
      return {...settings,status:presenceAdapter?.getStatus()??{connected:false,enabled:settings.enabled}};
    } catch(error){const response=fritzBoxRequestError(error);return securityError(reply,request,response.status,response.code,response.message);}
  });

  app.post<{Body:unknown}>("/api/presence/test", async(request,reply)=>{
    if(!presenceAdapter) return securityError(reply,request,503,"PRESENCE_ADAPTER_UNAVAILABLE","Presence adapter is unavailable.");
    const parsed=fritzBoxPresenceTestSchema.safeParse(request.body); if(!parsed.success) return securityError(reply,request,400,"INVALID_REQUEST","Invalid FRITZ!Box connection data.");
    try {
      const stored=await getFritzBoxPresenceConnection(); const password=parsed.data.password===undefined?stored.password:parsed.data.password;
      const result=await presenceAdapter.testConnection({baseUrl:normalizeFritzBoxBaseUrl(parsed.data.baseUrl),username:parsed.data.username,password,tlsInsecure:parsed.data.tlsInsecure});
      return {status:"ok",...result};
    } catch(error){const response=fritzBoxRequestError(error);return securityError(reply,request,response.status,response.code,response.message);}
  });

  app.post<{Body:unknown}>("/api/presence/devices", { config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "presence-device-create" } } }, async(request,reply)=>{
    const parsed=presenceTargetSchema.safeParse(request.body); if(!parsed.success) return securityError(reply,request,400,"INVALID_REQUEST","Invalid presence device.");
    try {const target=await createPresenceTarget(parsed.data.name,normalizePresenceMac(parsed.data.macAddress),parsed.data.absenceDelaySeconds??undefined);if(presenceAdapter)await presenceAdapter.reload();return reply.code(201).send(target);}catch(error){if((error as {code?:string})?.code==="23505")return securityError(reply,request,409,"PRESENCE_MAC_EXISTS","This MAC address is already monitored.");const response=fritzBoxRequestError(error);return securityError(reply,request,response.status,response.code,response.message);}
  });

  app.put<{Params:{id:string};Body:unknown}>("/api/presence/devices/:id", { config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "presence-device-update" } } }, async(request,reply)=>{
    const parsed=presenceTargetSchema.safeParse(request.body); if(!parsed.success) return securityError(reply,request,400,"INVALID_REQUEST","Invalid presence device.");
    try {const target=await updatePresenceTarget(request.params.id,parsed.data.name,normalizePresenceMac(parsed.data.macAddress),parsed.data.absenceDelaySeconds??undefined);if(!target)return securityError(reply,request,404,"PRESENCE_DEVICE_NOT_FOUND","Presence device not found.");if(presenceAdapter)await presenceAdapter.reload();return target;}catch(error){if((error as {code?:string})?.code==="23505")return securityError(reply,request,409,"PRESENCE_MAC_EXISTS","This MAC address is already monitored.");const response=fritzBoxRequestError(error);return securityError(reply,request,response.status,response.code,response.message);}
  });

  app.delete<{Params:{id:string} }>("/api/presence/devices/:id", { config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "presence-device-delete" } } }, async(request,reply)=>{
    const deleted=await deletePresenceTarget(request.params.id); if(!deleted)return securityError(reply,request,404,"PRESENCE_DEVICE_NOT_FOUND","Presence device not found."); if(presenceAdapter)await presenceAdapter.reload(); return reply.code(204).send();
  });

  app.post("/api/presence/refresh", async(request,reply)=>{
    if(!presenceAdapter) return securityError(reply,request,503,"PRESENCE_ADAPTER_UNAVAILABLE","Presence adapter is unavailable.");
    try {await presenceAdapter.reconcile();return {status:"ok",gateway:presenceAdapter.getStatus()};}catch(error){const response=fritzBoxRequestError(error);return securityError(reply,request,response.status,response.code,response.message);}
  });

  app.get("/api/settings/shelly", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "shelly-settings-read" } }
  }, async()=>getShellySettings());
  app.put<{Body:unknown}>("/api/settings/shelly",async(request,reply)=>{
    const parsed=shellySettingsSchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:{code:"INVALID_REQUEST",message:parsed.error.issues[0]?.message,requestId:request.id}});
    try {
      return await updateShellySettings(parsed.data.username,parsed.data.password);
    } catch (error) {
      const code = error instanceof Error ? error.message : "SETTINGS_UPDATE_FAILED";
      if (code === "ENCRYPTION_KEY_MISMATCH") return reply.code(409).send({error:{code,message:"Stored Shelly credentials cannot be decrypted. Enter the password again to replace them.",requestId:request.id}});
      throw error;
    }
  });

  app.get("/api/settings/phoscon", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "phoscon-settings-read" } }
  }, async () => ({ ...(await getPhosconSettings()), gateway: phosconAdapter.getStatus() }));
  app.put<{Body:unknown}>("/api/settings/phoscon", async (request, reply) => {
    const parsed = phosconSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message, requestId: request.id } });
    try {
      const gateway = await phosconAdapter.configure(parsed.data.baseUrl, parsed.data.apiKey);
      return { ...(await getPhosconSettings()), gateway };
    } catch (error) {
      const response = phosconRequestError(error);
      return reply.code(response.status).send({ error: { code: response.code, message: response.message, requestId: request.id } });
    }
  });
  app.post<{Body:unknown}>("/api/settings/phoscon/pair", async (request, reply) => {
    const parsed = phosconPairSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message, requestId: request.id } });
    try {
      const gateway = await phosconAdapter.pair(parsed.data.baseUrl);
      return { ...(await getPhosconSettings()), gateway };
    } catch (error) {
      const response = phosconRequestError(error);
      return reply.code(response.status).send({ error: { code: response.code, message: response.message, requestId: request.id } });
    }
  });
  app.delete("/api/settings/phoscon", async (_request, reply) => {
    await phosconAdapter.disconnect();
    return reply.code(204).send();
  });

  app.get("/api/settings/openccu", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "openccu-settings-read" } }
  }, async () => ({ ...(await getOpenCcuSettings()), gateway: openCcuAdapter.getStatus() }));
  app.put<{ Body: unknown }>("/api/settings/openccu", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "openccu-settings-write" } }
  }, async (request, reply) => {
    const parsed = openCcuSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message, requestId: request.id } });
    try {
      const gateway = await openCcuAdapter.configure(parsed.data.baseUrl, parsed.data.username, parsed.data.password);
      return { ...(await getOpenCcuSettings()), gateway };
    } catch (error) {
      const response = openCcuRequestError(error);
      await writeSystemLog("error", "openccu", response.code, "OpenCCU connection test failed", { ...(response.details ?? {}), requestId: request.id }).catch(() => undefined);
      return reply.code(response.status).send({ error: { code: response.code, message: response.message, details: response.details, requestId: request.id } });
    }
  });
  app.post<{ Body: unknown }>("/api/settings/openccu/diagnose", {
    config: { rateLimit: { max: 6, timeWindow: rateWindowMs, groupId: "openccu-diagnostics" } }
  }, async (request, reply) => {
    const parsed = openCcuDiagnosticSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message, requestId: request.id } });
    try {
      return { report: await openCcuAdapter.diagnose(parsed.data.baseUrl, parsed.data.username, parsed.data.password) };
    } catch (error) {
      const response = openCcuRequestError(error);
      await writeSystemLog("error", "openccu", response.code, "OpenCCU diagnostic could not be started", { ...(response.details ?? {}), requestId: request.id }).catch(() => undefined);
      return reply.code(response.status).send({ error: { code: response.code, message: response.message, details: response.details, requestId: request.id } });
    }
  });
  app.delete("/api/settings/openccu", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "openccu-settings-delete" } }
  }, async (_request, reply) => {
    await openCcuAdapter.disconnect();
    return reply.code(204).send();
  });

  app.post<{ Body: unknown }>("/api/adapters/virtual/devices", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "virtual-device-create" } }
  }, async (request, reply) => {
    if (!virtualAdapter) return reply.code(503).send({ error: { code: "VIRTUAL_ADAPTER_UNAVAILABLE", message: "Virtual devices are not available.", requestId: request.id } });
    const parsed = virtualDeviceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request", requestId: request.id } });
    const rooms = await listRooms();
    const room = parsed.data.roomId ? rooms.find(item => item.id === parsed.data.roomId) : undefined;
    if (parsed.data.roomId && !room) return reply.code(404).send({ error: { code: "ROOM_NOT_FOUND", message: "Room not found", requestId: request.id } });
    const device = await virtualAdapter.createSwitch(parsed.data.name, room?.id, room?.name);
    await writeSystemLog("info", "virtual", "VIRTUAL_DEVICE_CREATED", "Virtual switch created", { deviceId: device.id, name: device.name, roomId: device.roomId ?? null }).catch(() => undefined);
    return reply.code(201).send(device);
  });

  app.get("/api/automations", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "automations-read" } }
  }, async (_request, reply) => {
    if (!automationEngine) return reply.code(503).send({ error: { code: "AUTOMATION_ENGINE_UNAVAILABLE", message: "Automations are not available." } });
    return { automations: automationEngine.list() };
  });
  app.post<{ Body: unknown }>("/api/automations", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "automations-create" } }
  }, async (request, reply) => {
    if (!automationEngine) return reply.code(503).send({ error: { code: "AUTOMATION_ENGINE_UNAVAILABLE", message: "Automations are not available.", requestId: request.id } });
    const parsed = automationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request", requestId: request.id } });
    if (!await automationRoomExists(parsed.data.roomId)) return reply.code(404).send({ error: { code: "AUTOMATION_ROOM_NOT_FOUND", message: "The selected room does not exist.", requestId: request.id } });
    try {
      const automation = await automationEngine.create(normalizeAutomationInput(parsed.data));
      await writeSystemLog("info", "automation", "AUTOMATION_CREATED", "Automation created", { automationId: automation.id, automationName: automation.name }).catch(() => undefined);
      return reply.code(201).send(automation);
    } catch (error) {
      const response = automationError(error);
      return reply.code(response.status).send({ error: { code: response.code, message: response.message, requestId: request.id } });
    }
  });
  app.put<{ Params: { id: string }; Body: unknown }>("/api/automations/:id", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "automations-update" } }
  }, async (request, reply) => {
    if (!automationEngine) return reply.code(503).send({ error: { code: "AUTOMATION_ENGINE_UNAVAILABLE", message: "Automations are not available.", requestId: request.id } });
    const parsed = automationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request", requestId: request.id } });
    if (!await automationRoomExists(parsed.data.roomId)) return reply.code(404).send({ error: { code: "AUTOMATION_ROOM_NOT_FOUND", message: "The selected room does not exist.", requestId: request.id } });
    try { return await automationEngine.update(request.params.id, normalizeAutomationInput(parsed.data)); }
    catch (error) { const response = automationError(error); return reply.code(response.status).send({ error: { code: response.code, message: response.message, requestId: request.id } }); }
  });
  app.patch<{ Params: { id: string }; Body: unknown }>("/api/automations/:id/enabled", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "automations-enable" } }
  }, async (request, reply) => {
    if (!automationEngine) return reply.code(503).send({ error: { code: "AUTOMATION_ENGINE_UNAVAILABLE", message: "Automations are not available.", requestId: request.id } });
    const parsed = automationEnabledSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request", requestId: request.id } });
    try { return await automationEngine.setEnabled(request.params.id, parsed.data.enabled); }
    catch (error) { const response = automationError(error); return reply.code(response.status).send({ error: { code: response.code, message: response.message, requestId: request.id } }); }
  });
  app.delete<{ Params: { id: string } }>("/api/automations/:id", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "automations-delete" } }
  }, async (request, reply) => {
    if (!automationEngine) return reply.code(503).send({ error: { code: "AUTOMATION_ENGINE_UNAVAILABLE", message: "Automations are not available.", requestId: request.id } });
    try { await automationEngine.remove(request.params.id); return reply.code(204).send(); }
    catch (error) { const response = automationError(error); return reply.code(response.status).send({ error: { code: response.code, message: response.message, requestId: request.id } }); }
  });

  app.get("/api/devices", async () => registry.all());
  app.get<{ Params: { id: string } }>("/api/devices/:id", async (request, reply) => registry.get(request.params.id) ?? reply.code(404).send({ error: { code: "DEVICE_NOT_FOUND", message: "Device not found", requestId: request.id } }));
  app.patch<{ Params: { id: string }; Body: unknown }>("/api/devices/:id/config", async (request, reply) => {
    const parsed = patchSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request", requestId: request.id } });
    try {
      const current = registry.get(request.params.id);
      if ((parsed.data.presentationType && parsed.data.presentationType !== "auto" || parsed.data.hidden !== undefined) && !current) {
        return reply.code(404).send({ error: { code: "DEVICE_NOT_FOUND", message: "Device not found", requestId: request.id } });
      }
      if (parsed.data.presentationType && parsed.data.presentationType !== "auto" && current && !supportsPresentationOverride(current)) {
        return reply.code(409).send({ error: { code: "PRESENTATION_TYPE_NOT_SUPPORTED", message: "This device cannot be assigned a switch, outlet, light or fan function.", requestId: request.id } });
      }
      if (current?.source === "virtual" && parsed.data.presentationType && !["auto", "switch"].includes(parsed.data.presentationType)) {
        return reply.code(409).send({ error: { code: "VIRTUAL_PRESENTATION_TYPE_NOT_SUPPORTED", message: "Virtual devices currently support the switch type only.", requestId: request.id } });
      }
      if (parsed.data.hidden !== undefined && current?.source !== "phoscon") {
        return reply.code(409).send({ error: { code: "VISIBILITY_NOT_SUPPORTED", message: "Only Zigbee devices can be hidden from the Zigbee overview.", requestId: request.id } });
      }
      const rooms = await listRooms();
      let room: string | undefined;
      if (parsed.data.roomId) {
        room=rooms.find(item=>item.id===parsed.data.roomId)?.name;
        if (!room) return reply.code(404).send({ error: { code: "ROOM_NOT_FOUND", message: "Room not found", requestId: request.id } });
      }
      const homekitRequested = parsed.data.homekitEnabled !== undefined || parsed.data.homekitName !== undefined || parsed.data.homekitUseSaltaRoom !== undefined || parsed.data.homekitRoomId !== undefined;
      const presentationType = parsed.data.presentationType ?? current?.presentationType;
      const candidate = current ? { ...current, presentationType } : undefined;
      if (parsed.data.homekitEnabled === true && candidate && !isHomeKitSupportedDevice(candidate)) {
        return reply.code(409).send({ error: { code: "HOMEKIT_NOT_SUPPORTED", message: "This device type is not supported by the SALTA HomeKit bridge yet.", requestId: request.id } });
      }
      const useSaltaRoom = parsed.data.homekitUseSaltaRoom ?? current?.homekitUseSaltaRoom ?? true;
      let homekitRoom: string | undefined;
      const requestedHomeKitRoomId = useSaltaRoom ? undefined : (parsed.data.homekitRoomId ?? current?.homekitRoomId);
      if (requestedHomeKitRoomId) {
        homekitRoom = rooms.find(item=>item.id===requestedHomeKitRoomId)?.name;
        if (!homekitRoom) return reply.code(404).send({ error: { code: "HOMEKIT_ROOM_NOT_FOUND", message: "The selected HomeKit target room does not exist in SALTA.", requestId: request.id } });
      }
      const { homekitEnabled: _homekitEnabled, homekitName: _homekitName, homekitUseSaltaRoom: _homekitUseSaltaRoom, homekitRoomId: _homekitRoomId, ...devicePatch } = parsed.data;
      let updated = await registry.patch(request.params.id,{...devicePatch,roomId:parsed.data.roomId ?? undefined,room});
      if (homekitRequested) {
        updated = await registry.patchHomeKit(request.params.id,{
          enabled: parsed.data.homekitEnabled ?? updated.homekitEnabled,
          name: parsed.data.homekitName === null ? undefined : (parsed.data.homekitName ?? updated.homekitName),
          useSaltaRoom,
          roomId: requestedHomeKitRoomId,
          room: homekitRoom
        });
      }
      return updated;
    } catch { return reply.code(404).send({ error: { code: "DEVICE_NOT_FOUND", message: "Device not found", requestId: request.id } }); }
  });
  app.delete<{ Params: { id: string } }>("/api/devices/:id", async (request, reply) => {
    try {
      const current = registry.get(request.params.id);
      if (!current) await shellyAdapter.remove(request.params.id);
      else if (current.source === "shelly") await shellyAdapter.remove(request.params.id);
      else if (current.source === "virtual" && virtualAdapter) await virtualAdapter.remove(request.params.id);
      else throw new Error("ADAPTER_NOT_SUPPORTED");
      return reply.code(204).send();
    } catch (error) {
      const code = error instanceof Error ? error.message : "DEVICE_DELETE_FAILED";
      const status = code === "DEVICE_NOT_FOUND" ? 404 : code === "ADAPTER_NOT_SUPPORTED" ? 400 : 500;
      const message = code === "DEVICE_NOT_FOUND" ? "Device not found" : code === "ADAPTER_NOT_SUPPORTED" ? "This device cannot be removed from this SALTA page" : "Device could not be removed";
      return reply.code(status).send({ error: { code, message, requestId: request.id } });
    }
  });
  app.put<{Params:{id:string};Body:unknown}>("/api/devices/:id/credentials",async(request,reply)=>{
    const parsed=credentialSchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:{code:"INVALID_REQUEST",message:parsed.error.issues[0]?.message,requestId:request.id}});
    if(parsed.data.credentialMode==="custom" && !parsed.data.username) return reply.code(400).send({error:{code:"USERNAME_REQUIRED",message:"A username is required for custom credentials",requestId:request.id}});
    const current = registry.get(request.params.id);
    if (!current) return reply.code(404).send({error:{code:"DEVICE_NOT_FOUND",message:"Device not found",requestId:request.id}});
    if (current.source !== "shelly") return reply.code(409).send({error:{code:"CREDENTIALS_NOT_SUPPORTED",message:"Per-device credentials are only supported for Shelly devices.",requestId:request.id}});
    return registry.patchCredentials(request.params.id,parsed.data.credentialMode,parsed.data.username,parsed.data.password);
  });
  app.post<{ Params: { id: string }; Body: unknown }>("/api/devices/:id/command", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "device-command" } }
  }, async (request, reply) => {
    const parsed = commandSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request", requestId: request.id } });
    const id = randomUUID();
    try {
      await pool.query("insert into commands(id,device_id,capability,value,source,status) values($1,$2,$3,$4,$5,$6)", [id, request.params.id, parsed.data.capability, JSON.stringify(parsed.data.value ?? null), "api", "requested"]);
      const current=registry.get(request.params.id); if(!current) throw new Error("DEVICE_NOT_FOUND");
      const command = { deviceId: request.params.id, capability: parsed.data.capability, value: parsed.data.value, source: "api" as const };
      let device;
      if (commandRouter) device = await commandRouter.command(command);
      else if (current.source === "shelly") device = await shellyAdapter.command(command);
      else if (current.source === "phoscon") device = await phosconAdapter.command(command);
      else if (current.source === "openccu") device = await openCcuAdapter.command(command);
      else if (current.source === "virtual" && virtualAdapter) device = await virtualAdapter.command(command);
      else throw new Error("ADAPTER_NOT_SUPPORTED");
      await pool.query("update commands set status='confirmed',updated_at=now() where id=$1", [id]); return { commandId: id, status: "confirmed", device };
    } catch (error) {
      const message = error instanceof Error ? error.message : "COMMAND_FAILED";
      await pool.query("update commands set status='failed',error=$2,updated_at=now() where id=$1", [id, message]).catch(() => undefined);
      if (message.startsWith("PHOSCON_")) {
        const response = phosconRequestError(error);
        return reply.code(response.status).send({ error: { code: response.code, message: response.message, requestId: request.id } });
      }
      if (message.startsWith("OPENCCU_")) {
        const response = openCcuRequestError(error);
        return reply.code(response.status).send({ error: { code: response.code, message: response.message, details: response.details, requestId: request.id } });
      }
      if (message === "ENCRYPTION_KEY_MISMATCH") {
        const source = registry.get(request.params.id)?.source;
        const response = source === "openccu" ? openCcuRequestError(error) : source === "phoscon" ? phosconRequestError(error) : shellyRequestError(error);
        return reply.code(response.status).send({ error: { code: response.code, message: response.message, details: "details" in response ? response.details : undefined, requestId: request.id } });
      }
      return reply.code(message === "DEVICE_NOT_FOUND" ? 404 : 400).send({ error: { code: message, message, requestId: request.id } });
    }
  });
  app.get("/api/commands", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "commands-read" } }
  }, async () => (await pool.query("select * from commands order by created_at desc limit 100")).rows);
  app.post("/api/adapters/shelly/reconcile", async () => { await shellyAdapter.reconcile(); return { status: "ok" }; });
  app.post("/api/adapters/phoscon/reconcile", async (request, reply) => {
    try {
      const settings = await getPhosconSettings();
      if (!settings.apiKeyConfigured) throw new Error("PHOSCON_NOT_CONFIGURED");
      await phosconAdapter.reconcile();
      return { status: "ok", gateway: phosconAdapter.getStatus() };
    }
    catch (error) {
      const response = phosconRequestError(error);
      return reply.code(response.status).send({ error: { code: response.code, message: response.message, requestId: request.id } });
    }
  });
  app.post("/api/adapters/openccu/reconcile", {
    config: { rateLimit: { max: 12, timeWindow: rateWindowMs, groupId: "openccu-reconcile" } }
  }, async (request, reply) => {
    try {
      const settings = await getOpenCcuSettings();
      if (!settings.passwordConfigured) throw new Error("OPENCCU_NOT_CONFIGURED");
      await openCcuAdapter.reconcile(true, "manual");
      return { status: "ok", gateway: openCcuAdapter.getStatus() };
    } catch (error) {
      const response = openCcuRequestError(error);
      return reply.code(response.status).send({ error: { code: response.code, message: response.message, details: response.details, requestId: request.id } });
    }
  });

  app.get("/api/system/climate-mode", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "climate-mode-read" } }
  }, async (_request, reply) => {
    if (!climateMode) return reply.code(503).send({ error: { code: "CLIMATE_MODE_UNAVAILABLE", message: "Climate mode is not available" } });
    return climateMode.status();
  });
  app.put<{ Body: unknown }>("/api/system/climate-mode", {
    config: { rateLimit: { max: 12, timeWindow: rateWindowMs, groupId: "climate-mode-write" } }
  }, async (request, reply) => {
    const parsed = climateModeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message, requestId: request.id } });
    if (!climateMode) return reply.code(503).send({ error: { code: "CLIMATE_MODE_UNAVAILABLE", message: "Climate mode is not available", requestId: request.id } });
    return climateMode.apply(parsed.data.mode);
  });

  app.get("/api/settings/climate-mode", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "climate-mode-settings-read" } }
  }, async (_request, reply) => {
    if (!climateMode) return reply.code(503).send({ error: { code: "CLIMATE_MODE_UNAVAILABLE", message: "Climate mode is not available" } });
    return climateMode.status();
  });
  app.put<{ Body: unknown }>("/api/settings/climate-mode", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "climate-mode-settings-write" } }
  }, async (request, reply) => {
    const parsed = climateModeSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message, requestId: request.id } });
    if (!climateMode) return reply.code(503).send({ error: { code: "CLIMATE_MODE_UNAVAILABLE", message: "Climate mode is not available", requestId: request.id } });
    return climateMode.setWinterMode(parsed.data.winterMode);
  });

  app.get("/api/settings/general", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "general-settings-read" } }
  }, async () => getGeneralSettings());
  app.put<{ Body: unknown }>("/api/settings/general", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "general-settings-write" } }
  }, async (request, reply) => {
    const parsed = generalSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message, requestId: request.id } });
    return updateGeneralSettings(parsed.data);
  });

  app.get("/api/settings/homekit", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "homekit-settings-read" } }
  }, async (request, reply) => {
    if (!homeKitBridge) return reply.code(503).send({ error: { code: "HOMEKIT_SERVICE_UNAVAILABLE", message: "HomeKit service is not available", requestId: request.id } });
    const status = await homeKitBridge.status();
    return {
      enabled: status.enabled,
      name: status.name,
      username: status.username,
      networkInterface: status.networkInterface,
      encryptionStatus: status.encryptionStatus,
      running: status.running,
      paired: status.paired,
      advertised: status.advertised,
      listeningAddress: status.listeningAddress,
      listeningPort: status.listeningPort,
      port: status.port,
      pairingCode: status.paired ? undefined : status.pin,
      setupUri: status.paired ? undefined : status.setupUri,
      lastError: status.lastError,
      supportedDevices: status.supportedDevices,
      publishedDevices: status.publishedDevices,
      networkInterfaces: status.networkInterfaces
    };
  });
  app.put<{ Body: unknown }>("/api/settings/homekit", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "homekit-settings-write" } }
  }, async (request, reply) => {
    if (!homeKitBridge) return reply.code(503).send({ error: { code: "HOMEKIT_SERVICE_UNAVAILABLE", message: "HomeKit service is not available", requestId: request.id } });
    const parsed = homeKitSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message, requestId: request.id } });
    try {
      const status = await homeKitBridge.configure(parsed.data);
      return {
        enabled: status.enabled, name: status.name, username: status.username, networkInterface: status.networkInterface, encryptionStatus: status.encryptionStatus,
        running: status.running, paired: status.paired, advertised: status.advertised, listeningAddress: status.listeningAddress, listeningPort: status.listeningPort, port: status.port,
        pairingCode: status.paired ? undefined : status.pin, setupUri: status.paired ? undefined : status.setupUri, lastError: status.lastError, supportedDevices: status.supportedDevices,
        publishedDevices: status.publishedDevices, networkInterfaces: status.networkInterfaces
      };
    } catch (error) {
      const code = error instanceof Error ? error.message : "HOMEKIT_CONFIGURATION_FAILED";
      const status = code === "HOMEKIT_ENCRYPTION_KEY_MISMATCH" ? 409 : code === "HOMEKIT_NETWORK_INTERFACE_INVALID" ? 400 : 502;
      const message = code === "HOMEKIT_ENCRYPTION_KEY_MISMATCH"
        ? "Stored HomeKit settings cannot be decrypted with the current SALTA encryption key. Reset HomeKit pairing or restore the matching recovery backup."
        : code === "HOMEKIT_NETWORK_INTERFACE_INVALID"
          ? "Select a network interface that is currently available on the SALTA host."
          : "The HomeKit bridge could not apply the requested configuration.";
      if (status >= 500) request.log.error({ err: error }, "HomeKit configuration failed");
      return reply.code(status).send({ error: { code, message, requestId: request.id } });
    }
  });
  app.post("/api/settings/homekit/reset", {
    config: { rateLimit: { max: 3, timeWindow: rateWindowMs, groupId: "homekit-pairing-reset" } }
  }, async (request, reply) => {
    if (!homeKitBridge) return reply.code(503).send({ error: { code: "HOMEKIT_SERVICE_UNAVAILABLE", message: "HomeKit service is not available", requestId: request.id } });
    try {
      const status = await homeKitBridge.resetPairing();
      return {
        enabled: status.enabled, name: status.name, username: status.username, networkInterface: status.networkInterface, encryptionStatus: status.encryptionStatus,
        running: status.running, paired: status.paired, advertised: status.advertised, listeningAddress: status.listeningAddress, listeningPort: status.listeningPort, port: status.port,
        pairingCode: status.pin, setupUri: status.setupUri, lastError: status.lastError, supportedDevices: status.supportedDevices,
        publishedDevices: status.publishedDevices, networkInterfaces: status.networkInterfaces
      };
    } catch (error) {
      const code = error instanceof Error ? error.message : "HOMEKIT_PAIRING_RESET_FAILED";
      const status = code === "HOMEKIT_ENCRYPTION_KEY_MISMATCH" ? 409 : 500;
      if (status >= 500) request.log.error({ err: error }, "HomeKit pairing reset failed");
      return reply.code(status).send({ error: { code, message: code === "HOMEKIT_ENCRYPTION_KEY_MISMATCH" ? "Stored HomeKit settings cannot be decrypted with the current SALTA encryption key." : "HomeKit pairing data could not be reset.", requestId: request.id } });
    }
  });

  app.get("/api/settings/notifications", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "notification-settings-read" } }
  }, async () => ({ ...(await getPushoverSettings()), ...(batteryMonitor ? await batteryMonitor.status() : { warnings: [] }) }));
  app.put<{ Body: unknown }>("/api/settings/notifications", {
    config: { rateLimit: { max: config.RATE_LIMIT_MUTATIONS_PER_MINUTE, timeWindow: rateWindowMs, groupId: "notification-settings-write" } }
  }, async (request, reply) => {
    const parsed = pushoverSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message, requestId: request.id } });
    try {
      const settings = await updatePushoverSettings(parsed.data);
      const status = batteryMonitor ? await batteryMonitor.evaluate() : { warnings: [] };
      return { ...settings, ...status };
    } catch (error) {
      const code = error instanceof Error ? error.message : "NOTIFICATION_SETTINGS_FAILED";
      const status = code === "ENCRYPTION_KEY_MISMATCH" ? 409 : 500;
      return reply.code(status).send({ error: { code, message: code === "ENCRYPTION_KEY_MISMATCH" ? "Stored Pushover credentials cannot be decrypted with the current SALTA encryption key." : "Notification settings could not be saved", requestId: request.id } });
    }
  });
  app.post("/api/settings/notifications/test", {
    config: { rateLimit: { max: 6, timeWindow: rateWindowMs, groupId: "notification-test" } }
  }, async (request, reply) => {
    if (!batteryMonitor) return reply.code(503).send({ error: { code: "NOTIFICATION_SERVICE_UNAVAILABLE", message: "Notification service is not available", requestId: request.id } });
    try {
      await batteryMonitor.test();
      return { status: "ok" };
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0] : "PUSHOVER_REQUEST_FAILED";
      const status = code === "PUSHOVER_NOT_CONFIGURED" ? 409 : 502;
      return reply.code(status).send({ error: { code, message: code === "PUSHOVER_NOT_CONFIGURED" ? "Configure and save the Pushover user key and API token first." : "Pushover test notification failed.", requestId: request.id } });
    }
  });

  app.post<{ Body: unknown }>("/api/settings/disaster-recovery-backup", {
    bodyLimit: 16 * 1024,
    config: { rateLimit: { max: 6, timeWindow: rateWindowMs, groupId: "disaster-recovery-export" } }
  }, async (request, reply) => {
    const parsed = disasterRecoveryExportSchema.safeParse(request.body);
    if (!parsed.success) return securityError(reply, request, 400, "INVALID_REQUEST", "A backup password with at least 12 characters is required.");
    try {
      const backup = await createDisasterRecoveryBackup("0.8.51", parsed.data.password);
      const stamp = backup.createdAt.replace(/[:.]/g, "-");
      reply.header("Cache-Control", "no-store");
      reply.header("Content-Disposition", `attachment; filename="SALTA-full-backup-${stamp}.salta-backup.json"`);
      await writeSystemLog("info", "system", "DISASTER_RECOVERY_BACKUP_EXPORTED", "SALTA full recovery backup exported", {
        rooms: backup.summary.rooms, devices: backup.summary.devices, automations: backup.summary.automations, homeKitFiles: backup.summary.homeKitFiles
      }).catch(() => undefined);
      return backup;
    } catch (error) {
      const code = error instanceof Error ? error.message : "DISASTER_RECOVERY_EXPORT_FAILED";
      const status = code === "DISASTER_RECOVERY_PASSWORD_INVALID" ? 400 : 500;
      if (status >= 500) request.log.error({ err: error }, "Disaster recovery backup export failed");
      return securityError(reply, request, status, code, status === 400 ? "A backup password with at least 12 characters is required." : "The SALTA full recovery backup could not be created.");
    }
  });

  app.post<{ Body: unknown }>("/api/settings/disaster-recovery-backup/import", {
    bodyLimit: 10 * 1024 * 1024,
    config: { rateLimit: { max: 3, timeWindow: rateWindowMs, groupId: "disaster-recovery-import" } }
  }, async (request, reply) => {
    const parsed = disasterRecoveryImportSchema.safeParse(request.body);
    if (!parsed.success) return securityError(reply, request, 400, "INVALID_REQUEST", "Select a valid backup and enter its backup password.");
    try {
      const result = await importDisasterRecoveryBackup(parsed.data.backup, parsed.data.password);
      await writeSystemLog("info", "system", "DISASTER_RECOVERY_BACKUP_IMPORTED", "SALTA full recovery backup imported", {
        sourceVersion: result.sourceVersion, rooms: result.rooms, devices: result.devices, automations: result.automations, presenceTargets: result.presenceTargets, homeKitFiles: result.homeKitFiles, deploymentWarnings: result.deploymentWarnings.length
      }).catch(() => undefined);
      if (restartAfterConfigurationImport) setTimeout(() => restartAfterConfigurationImport(), 750);
      return { status: "ok", ...result, restartScheduled: Boolean(restartAfterConfigurationImport) };
    } catch (error) {
      const code = error instanceof Error ? error.message : "DISASTER_RECOVERY_IMPORT_FAILED";
      const status = ["DISASTER_RECOVERY_PASSWORD_INVALID", "DISASTER_RECOVERY_INVALID", "DISASTER_RECOVERY_DECRYPT_FAILED", "DISASTER_RECOVERY_HOMEKIT_TOO_LARGE"].includes(code) ? 400
        : code === "DISASTER_RECOVERY_SCHEMA_MISMATCH" ? 409 : 500;
      const message = code === "DISASTER_RECOVERY_DECRYPT_FAILED"
        ? "The backup password is incorrect or the backup file was modified."
        : code === "DISASTER_RECOVERY_SCHEMA_MISMATCH"
          ? "The backup uses an incompatible SALTA database schema."
          : code === "DISASTER_RECOVERY_PASSWORD_INVALID"
            ? "A backup password with at least 12 characters is required."
            : code === "DISASTER_RECOVERY_HOMEKIT_TOO_LARGE"
              ? "The HomeKit recovery data in the backup exceeds the supported size."
              : code === "DISASTER_RECOVERY_INVALID"
                ? "The selected file is not a valid SALTA full recovery backup."
                : "The SALTA full recovery backup could not be imported.";
      if (status >= 500) request.log.error({ err: error }, "Disaster recovery backup import failed");
      else request.log.warn({ code }, "Disaster recovery backup import rejected");
      return securityError(reply, request, status, code, message);
    }
  });

  app.get<{ Querystring: unknown }>("/api/logs", {
    config: { rateLimit: { max: 60, timeWindow: rateWindowMs, groupId: "system-logs-read" } }
  }, async (request, reply) => {
    const parsed = systemLogQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message, requestId: request.id } });
    return { entries: await listSystemLogs(parsed.data.limit, parsed.data.source, parsed.data.level) };
  });
  app.delete("/api/logs", {
    config: { rateLimit: { max: 6, timeWindow: rateWindowMs, groupId: "system-logs-clear" } }
  }, async (_request, reply) => {
    await clearSystemLogs();
    return reply.code(204).send();
  });

  app.post<{Body:unknown}>("/api/adapters/shelly/discover",async(request,reply)=>{
    const parsed=shellyDiscoverySchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:{code:"INVALID_REQUEST",message:parsed.error.issues[0]?.message,requestId:request.id}});
    try { const credentials=await getGlobalShellyCredentials(); return {devices:await shellyAdapter.discover(parsed.data.subnet,credentials.username,credentials.password)}; }
    catch(error){const response=shellyRequestError(error);return reply.code(response.status).send({error:{code:response.code,message:response.message,requestId:request.id}});}
  });
  app.post<{Body:unknown}>("/api/adapters/shelly/devices",async(request,reply)=>{
    const parsed=shellyAddSchema.safeParse(request.body);
    if(!parsed.success) return reply.code(400).send({error:{code:"INVALID_REQUEST",message:parsed.error.issues[0]?.message ?? "Invalid device data",requestId:request.id}});
    if(parsed.data.credentialMode==="custom" && !parsed.data.username?.trim()) return reply.code(400).send({error:{code:"USERNAME_REQUIRED",message:"A username is required for custom credentials",requestId:request.id}});
    try {
      let username=parsed.data.username??"",password=parsed.data.password??"";
      if(parsed.data.credentialMode==="inherit"){const global=await getGlobalShellyCredentials();username=global.username;password=global.password;}
      if(parsed.data.credentialMode==="none"){username="";password="";}
      const room=parsed.data.roomId?(await listRooms()).find(x=>x.id===parsed.data.roomId)?.name:undefined;
      const devices=await shellyAdapter.add(parsed.data.host,username,password,parsed.data.name,parsed.data.roomId??undefined,room,parsed.data.credentialMode);
      const primary=devices[0];
      if(!primary) throw new Error("UNSUPPORTED_SHELLY_DEVICE");
      return reply.code(201).send({...primary,addedDevices:devices.length});
    } catch(error) {
      const response=shellyRequestError(error);
      if(response.status>=500) request.log.error({err:error,host:parsed.data.host},"Shelly device add failed");
      else request.log.warn({err:error,code:response.code,host:parsed.data.host},"Shelly device add rejected");
      return reply.code(response.status).send({error:{code:response.code,message:response.message,requestId:request.id}});
    }
  });
  app.get("/api/adapters", async () => {
    const phosconStatus = phosconAdapter.getStatus();
    const openCcuStatus = openCcuAdapter.getStatus();
    return [
      { id: "shelly", name: "Shelly", status: "connected", devices: registry.all().filter(x => x.source === "shelly").length },
      { id: "phoscon", name: "Phoscon / deCONZ", status: phosconStatus.connected ? "connected" : "disconnected", devices: registry.all().filter(x => x.source === "phoscon").length, gateway: phosconStatus },
      { id: "openccu", name: "OpenCCU / HomeMatic", status: openCcuStatus.connected ? "connected" : "disconnected", devices: registry.all().filter(x => x.source === "openccu").length, gateway: openCcuStatus }
    ];
  });
  app.setErrorHandler((error, request, reply) => { request.log.error({ err: error }, "Unhandled request error"); return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Internal server error", requestId: request.id } }); });
  app.setNotFoundHandler(async (request, reply) => {
    const path = requestPath(request);
    if (path.startsWith("/api/") || path.startsWith("/auth/") || path.startsWith("/internal/")) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route not found", requestId: request.id } });
    }
    const staticFile = staticFiles.get(path);
    if (staticFile) return sendPublicFile(reply, publicDir, staticFile);
    return sendPublicFile(reply, publicDir, "index.html");
  });
  app.addHook("onClose", async () => security.close());
  return app;
}
