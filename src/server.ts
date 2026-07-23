import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { z } from "zod";
import type { DeviceRegistry } from "./registry.js";
import type { ShellyAdapter } from "./shelly-adapter.js";
import type { PhosconAdapter } from "./phoscon-adapter.js";
import { createRoom, deleteRoom, getGlobalShellyCredentials, getPhosconSettings, getShellySettings, inspectCredentialEncryption, listRooms, pool, reorderRooms, updateRoom, updateShellySettings } from "./db.js";
import { config } from "./config.js";
import { supportsPresentationOverride } from "./device-presentation.js";
import { clearSessionCookie, createSessionCookie, isIpInNetworks, safeEqual, SecurityManager, type AuthenticatedSession, type AuthMethod } from "./security.js";

const commandSchema = z.object({ capability: z.string().min(1).max(80), value: z.union([z.string(), z.number(), z.boolean()]).optional() });
const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  roomId: z.string().uuid().nullable().optional(),
  homekitEnabled: z.boolean().optional(),
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
const loginSchema = z.object({ username: z.string().max(64), password: z.string().max(1024) }).strict();

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
  reply.header("Cache-Control", fileName.endsWith(".html") ? "no-store" : "public, max-age=3600");
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

export function buildServer(registry: DeviceRegistry, shellyAdapter: ShellyAdapter, phosconAdapter: PhosconAdapter) {
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
      : path === "/api/adapters/shelly/reconcile" || path === "/api/adapters/phoscon/reconcile"
        ? security.consumeRateLimit(`reconcile:${ip}`, 12, rateWindowMs)
        : path === "/api/adapters/shelly/devices" && request.method === "POST"
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

  app.get("/internal/health", async () => ({ status: "ok", name: "SALTA", version: "0.6.2" }));

  app.get("/api/health", async () => ({ status: "ok", name: "SALTA", version: "0.6.2", time: new Date().toISOString() }));
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
        credentials: credentialEncryption.status,
        shellyCredential: credentialEncryption.globalCredential,
        phosconCredential: credentialEncryption.phosconCredential,
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
    return reply.code(204).send();
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
      if (parsed.data.hidden !== undefined && current?.source !== "phoscon") {
        return reply.code(409).send({ error: { code: "VISIBILITY_NOT_SUPPORTED", message: "Only Zigbee devices can be hidden from the Zigbee overview.", requestId: request.id } });
      }
      let room: string | undefined;
      if (parsed.data.roomId) room=(await listRooms()).find(item=>item.id===parsed.data.roomId)?.name;
      return await registry.patch(request.params.id,{...parsed.data,roomId:parsed.data.roomId ?? undefined,room});
    } catch { return reply.code(404).send({ error: { code: "DEVICE_NOT_FOUND", message: "Device not found", requestId: request.id } }); }
  });
  app.delete<{ Params: { id: string } }>("/api/devices/:id", async (request, reply) => {
    try {
      await shellyAdapter.remove(request.params.id);
      return reply.code(204).send();
    } catch (error) {
      const code = error instanceof Error ? error.message : "DEVICE_DELETE_FAILED";
      const status = code === "DEVICE_NOT_FOUND" ? 404 : code === "ADAPTER_NOT_SUPPORTED" ? 400 : 500;
      const message = code === "DEVICE_NOT_FOUND" ? "Device not found" : code === "ADAPTER_NOT_SUPPORTED" ? "This device cannot be removed by the Shelly adapter" : "Device could not be removed";
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
      if (current.source === "shelly") device = await shellyAdapter.command(command);
      else if (current.source === "phoscon") device = await phosconAdapter.command(command);
      else throw new Error("ADAPTER_NOT_SUPPORTED");
      await pool.query("update commands set status='confirmed',updated_at=now() where id=$1", [id]); return { commandId: id, status: "confirmed", device };
    } catch (error) {
      const message = error instanceof Error ? error.message : "COMMAND_FAILED";
      await pool.query("update commands set status='failed',error=$2,updated_at=now() where id=$1", [id, message]).catch(() => undefined);
      if (message.startsWith("PHOSCON_") || message === "ENCRYPTION_KEY_MISMATCH") {
        const response = phosconRequestError(error);
        return reply.code(response.status).send({ error: { code: response.code, message: response.message, requestId: request.id } });
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
    return [
      { id: "shelly", name: "Shelly", status: "connected", devices: registry.all().filter(x=>x.source==="shelly").length },
      { id: "phoscon", name: "Phoscon / deCONZ", status: phosconStatus.connected ? "connected" : "disconnected", devices: registry.all().filter(x=>x.source==="phoscon").length, gateway: phosconStatus }
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
