import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import type { DeviceRegistry } from "./registry.js";
import type { ShellyAdapter } from "./shelly-adapter.js";
import { createRoom, deleteRoom, getGlobalShellyCredentials, getShellySettings, inspectCredentialEncryption, listRooms, pool, updateRoom, updateShellySettings } from "./db.js";
import { config } from "./config.js";

const commandSchema = z.object({ capability: z.string().min(1).max(80), value: z.union([z.string(), z.number(), z.boolean()]).optional() });
const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  roomId: z.string().uuid().nullable().optional(),
  homekitEnabled: z.boolean().optional()
}).strict();
const credentialSchema = z.object({
  credentialMode: z.enum(["inherit","custom","none"]),
  username: z.string().max(120).optional(),
  password: z.string().max(512).optional()
}).strict();
const roomSchema = z.object({ name: z.string().trim().min(1).max(80), icon: z.string().trim().min(1).max(40).default("home"), sortOrder: z.number().int().min(0).max(10000).default(0) }).strict();
const shellyAddSchema = z.object({ host:z.string().trim().min(1).max(255), name:z.string().trim().max(120).optional(), roomId:z.string().uuid().nullable().optional(), credentialMode:z.enum(["inherit","custom","none"]).default("inherit"), username:z.string().max(120).optional(), password:z.string().max(512).optional() }).strict();
const shellyDiscoverySchema = z.object({ subnet:z.string().trim().min(7).max(32) }).strict();
const shellySettingsSchema = z.object({ username: z.string().max(120).default(""), password: z.string().max(512).optional() }).strict();


function shellyRequestError(error: unknown): { status: number; code: string; message: string } {
  const rawCode = error instanceof Error ? error.message : "SHELLY_REQUEST_FAILED";
  switch (rawCode) {
    case "AUTHENTICATION_FAILED":
      return { status: 401, code: rawCode, message: "Authentication failed. Check the selected Shelly credentials." };
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

function safeEqual(actual: string, expected: string): boolean {
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildServer(registry: DeviceRegistry, shellyAdapter: ShellyAdapter) {
  const app = Fastify({ logger: { level: config.LOG_LEVEL }, genReqId: () => randomUUID(), bodyLimit: 64 * 1024 });
  const publicDir = join(process.cwd(), "public");
  void app.register(fastifyStatic, { root: publicDir, prefix: "/" });

  app.addHook("onRequest", async (request, reply) => {
    if (!config.ADMIN_PASSWORD || request.url === "/api/health" || request.url === "/api/readiness") return;
    const header = request.headers.authorization;
    if (!header?.startsWith("Basic ")) { reply.header("WWW-Authenticate", 'Basic realm="SALTA"'); return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Authentication required", requestId: request.id } }); }
    try {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8"); const separator = decoded.indexOf(":");
      const username = separator >= 0 ? decoded.slice(0, separator) : ""; const password = separator >= 0 ? decoded.slice(separator + 1) : "";
      if (!safeEqual(username, config.ADMIN_USERNAME) || !safeEqual(password, config.ADMIN_PASSWORD)) { reply.header("WWW-Authenticate", 'Basic realm="SALTA"'); return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid credentials", requestId: request.id } }); }
    } catch { return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid credentials", requestId: request.id } }); }
  });

  app.get("/api/health", async () => ({ status: "ok", name: "SALTA", version: "0.4.14", time: new Date().toISOString() }));
  app.get("/api/readiness", async (_request, reply) => {
    try {
      await pool.query("select 1");
      const credentialEncryption = await inspectCredentialEncryption();
      const components = {
        database: "up",
        shellyAdapter: "up",
        credentials: credentialEncryption.status,
        invalidDeviceCredentials: credentialEncryption.invalidDeviceIds.length,
        devices: registry.all().length
      };
      if (credentialEncryption.status === "invalid") return reply.code(503).send({ status: "not-ready", components });
      return { status: "ready", components };
    } catch { return reply.code(503).send({ status: "not-ready", components: { database: "down" } }); }
  });

  app.get("/api/rooms", async () => listRooms());
  app.post<{Body:unknown}>("/api/rooms", async (request,reply)=>{
    const parsed=roomSchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:{code:"INVALID_REQUEST",message:parsed.error.issues[0]?.message,requestId:request.id}});
    try { return reply.code(201).send(await createRoom(parsed.data.name,parsed.data.icon,parsed.data.sortOrder)); }
    catch { return reply.code(409).send({error:{code:"ROOM_EXISTS",message:"A room with this name already exists",requestId:request.id}}); }
  });
  app.put<{Params:{id:string};Body:unknown}>("/api/rooms/:id",async(request,reply)=>{
    const parsed=roomSchema.safeParse(request.body); if(!parsed.success) return reply.code(400).send({error:{code:"INVALID_REQUEST",message:parsed.error.issues[0]?.message,requestId:request.id}});
    const room=await updateRoom(request.params.id,parsed.data.name,parsed.data.icon,parsed.data.sortOrder); return room ?? reply.code(404).send({error:{code:"ROOM_NOT_FOUND",message:"Room not found",requestId:request.id}});
  });
  app.delete<{Params:{id:string} }>("/api/rooms/:id",async(request,reply)=> (await deleteRoom(request.params.id)) ? reply.code(204).send() : reply.code(404).send({error:{code:"ROOM_NOT_FOUND",message:"Room not found",requestId:request.id}}));

  app.get("/api/settings/shelly",async()=>getShellySettings());
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

  app.get("/api/devices", async () => registry.all());
  app.get<{ Params: { id: string } }>("/api/devices/:id", async (request, reply) => registry.get(request.params.id) ?? reply.code(404).send({ error: { code: "DEVICE_NOT_FOUND", message: "Device not found", requestId: request.id } }));
  app.patch<{ Params: { id: string }; Body: unknown }>("/api/devices/:id/config", async (request, reply) => {
    const parsed = patchSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request", requestId: request.id } });
    try {
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
    try { return await registry.patchCredentials(request.params.id,parsed.data.credentialMode,parsed.data.username,parsed.data.password); }
    catch { return reply.code(404).send({error:{code:"DEVICE_NOT_FOUND",message:"Device not found",requestId:request.id}}); }
  });
  app.post<{ Params: { id: string }; Body: unknown }>("/api/devices/:id/command", async (request, reply) => {
    const parsed = commandSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid request", requestId: request.id } });
    const id = randomUUID();
    try {
      await pool.query("insert into commands(id,device_id,capability,value,source,status) values($1,$2,$3,$4,$5,$6)", [id, request.params.id, parsed.data.capability, JSON.stringify(parsed.data.value ?? null), "api", "requested"]);
      const current=registry.get(request.params.id); if(!current) throw new Error("DEVICE_NOT_FOUND");
      if(current.source!=="shelly") throw new Error("ADAPTER_NOT_SUPPORTED");
      const device = await shellyAdapter.command({ deviceId: request.params.id, capability: parsed.data.capability, value: parsed.data.value, source: "api" });
      await pool.query("update commands set status='confirmed',updated_at=now() where id=$1", [id]); return { commandId: id, status: "confirmed", device };
    } catch (error) {
      const message = error instanceof Error ? error.message : "COMMAND_FAILED"; await pool.query("update commands set status='failed',error=$2,updated_at=now() where id=$1", [id, message]).catch(() => undefined);
      return reply.code(message === "DEVICE_NOT_FOUND" ? 404 : 400).send({ error: { code: message, message, requestId: request.id } });
    }
  });
  app.get("/api/commands", async () => (await pool.query("select * from commands order by created_at desc limit 100")).rows);
  app.post("/api/adapters/shelly/reconcile", async () => { await shellyAdapter.reconcile(); return { status: "ok" }; });
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
  app.get("/api/adapters", async () => [{ id: "shelly", name: "Shelly", status: "connected", devices: registry.all().filter(x=>x.source==="shelly").length }]);
  app.setErrorHandler((error, request, reply) => { request.log.error({ err: error }, "Unhandled request error"); return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Internal server error", requestId: request.id } }); });
  app.setNotFoundHandler((request, reply) => request.url.startsWith("/api/") ? reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route not found", requestId: request.id } }) : reply.sendFile("index.html"));
  return app;
}
