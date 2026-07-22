import pg from "pg";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { decryptSecret, encryptSecret } from "./security/secrets.js";
import type { CredentialMode, Device, Room, ShellySettings } from "./types.js";
const { Pool } = pg;
export const pool = new Pool({ connectionString: config.DATABASE_URL, max: 10 });

const DATABASE_SCHEMA_VERSION = "0.5";

export async function initializeDatabaseSchema(): Promise<void> {
  const existing = await pool.query<{ devices: string | null; metadata: string | null }>(
    "SELECT to_regclass('public.devices')::text AS devices, to_regclass('public.salta_metadata')::text AS metadata"
  );
  const state = existing.rows[0];
  if (state?.devices && !state.metadata) {
    throw new Error("INCOMPATIBLE_DATABASE_SCHEMA: SALTA v0.5.4 requires a fresh PostgreSQL volume");
  }
  if (state?.metadata) {
    const version = await pool.query<{ value: string }>("SELECT value FROM salta_metadata WHERE key='schema_version'");
    if (version.rows[0]?.value !== DATABASE_SCHEMA_VERSION) {
      throw new Error(`INCOMPATIBLE_DATABASE_SCHEMA: expected ${DATABASE_SCHEMA_VERSION}, found ${version.rows[0]?.value ?? "unknown"}`);
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS salta_metadata (
      key text PRIMARY KEY,
      value text NOT NULL
    );
    INSERT INTO salta_metadata(key,value) VALUES('schema_version','${DATABASE_SCHEMA_VERSION}') ON CONFLICT(key) DO NOTHING;
    CREATE TABLE IF NOT EXISTS rooms (
      id uuid PRIMARY KEY,
      name text NOT NULL UNIQUE,
      icon text NOT NULL DEFAULT 'home',
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS devices (
      id text PRIMARY KEY,
      source text NOT NULL,
      source_id text NOT NULL,
      type text NOT NULL,
      presentation_type text NOT NULL DEFAULT 'auto',
      name text NOT NULL,
      host text,
      generation text,
      model text,
      firmware_version text,
      hostname text,
      mac_address text,
      profile text,
      component_kind text,
      component_id integer,
      channel_count integer,
      power_metering boolean,
      cover_support boolean,
      switch_support boolean,
      light_support boolean,
      input_support boolean,
      room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
      reachable boolean NOT NULL DEFAULT true,
      state jsonb NOT NULL DEFAULT '{}'::jsonb,
      capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
      homekit_enabled boolean NOT NULL DEFAULT true,
      credential_mode text NOT NULL DEFAULT 'inherit',
      credential_username text,
      credential_password text,
      last_seen timestamptz NOT NULL DEFAULT now(),
      last_event timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS adapter_settings (
      adapter_id text PRIMARY KEY,
      username text NOT NULL DEFAULT '',
      encrypted_password text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS commands (
      id uuid PRIMARY KEY,
      device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      capability text NOT NULL,
      value jsonb,
      source text NOT NULL,
      status text NOT NULL,
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS commands_device_idx ON commands(device_id, created_at DESC);
  `);
}

export async function upsertDevice(d: Device): Promise<void> {
  let roomId = d.roomId ?? null;
  if (!roomId && d.room) {
    await pool.query("INSERT INTO rooms(id,name) VALUES($1,$2) ON CONFLICT(name) DO NOTHING", [randomUUID(), d.room]);
    const roomResult = await pool.query<{id:string}>("SELECT id FROM rooms WHERE name=$1", [d.room]);
    roomId = roomResult.rows[0]?.id ?? null;
    d.roomId = roomId ?? undefined;
  }
  await pool.query(`INSERT INTO devices
    (id,source,source_id,type,presentation_type,name,host,generation,model,firmware_version,hostname,mac_address,profile,component_kind,component_id,channel_count,power_metering,cover_support,switch_support,light_support,input_support,room_id,reachable,state,capabilities,homekit_enabled,credential_mode,credential_username,last_seen,last_event,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,now())
    ON CONFLICT (id) DO UPDATE SET source=EXCLUDED.source, source_id=EXCLUDED.source_id, type=EXCLUDED.type, presentation_type=EXCLUDED.presentation_type, name=EXCLUDED.name,
    host=EXCLUDED.host, generation=EXCLUDED.generation, model=EXCLUDED.model, firmware_version=EXCLUDED.firmware_version,
    hostname=EXCLUDED.hostname, mac_address=EXCLUDED.mac_address, profile=EXCLUDED.profile, component_kind=EXCLUDED.component_kind, component_id=EXCLUDED.component_id,
    channel_count=EXCLUDED.channel_count, power_metering=EXCLUDED.power_metering, cover_support=EXCLUDED.cover_support,
    switch_support=EXCLUDED.switch_support, light_support=EXCLUDED.light_support, input_support=EXCLUDED.input_support,
    room_id=EXCLUDED.room_id, reachable=EXCLUDED.reachable, state=EXCLUDED.state,
    capabilities=EXCLUDED.capabilities, homekit_enabled=EXCLUDED.homekit_enabled, credential_mode=EXCLUDED.credential_mode,
    credential_username=EXCLUDED.credential_username, last_seen=EXCLUDED.last_seen, last_event=EXCLUDED.last_event, updated_at=now()`,
    [d.id,d.source,d.sourceId,d.type,d.presentationType??"auto",d.name,d.host??null,d.generation??null,d.model??null,d.firmwareVersion??null,d.hostname??null,d.macAddress??null,d.profile??null,d.componentKind??null,d.componentId??null,d.channelCount??null,d.powerMetering??null,d.coverSupport??null,d.switchSupport??null,d.lightSupport??null,d.inputSupport??null,roomId,d.reachable,JSON.stringify(d.state),JSON.stringify(d.capabilities),d.homekitEnabled,d.credentialMode,d.credentialUsername??null,d.lastSeen,d.lastEvent]);
}

export async function deleteDevice(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM devices WHERE id=$1", [id]);
  return result.rowCount === 1;
}

export async function listDevices(): Promise<Device[]> {
  const r=await pool.query(`SELECT d.id,d.source,d.source_id as "sourceId",d.type,d.presentation_type as "presentationType",d.name,d.host,d.generation,d.model,
    d.firmware_version as "firmwareVersion",d.hostname,d.mac_address as "macAddress",d.profile,d.component_kind as "componentKind",
    d.component_id as "componentId",d.channel_count as "channelCount",d.power_metering as "powerMetering",
    d.cover_support as "coverSupport",d.switch_support as "switchSupport",d.light_support as "lightSupport",d.input_support as "inputSupport",
    d.room_id as "roomId",r.name as room,d.reachable,d.state,d.capabilities,
    d.homekit_enabled as "homekitEnabled",d.credential_mode as "credentialMode",d.credential_username as "credentialUsername",
    (d.credential_password IS NOT NULL AND d.credential_password <> '') as "passwordConfigured",
    d.last_seen as "lastSeen",d.last_event as "lastEvent"
    FROM devices d LEFT JOIN rooms r ON r.id=d.room_id ORDER BY d.name`);
  return r.rows;
}

export async function setDeviceCredentials(id: string, mode: CredentialMode, username?: string, password?: string): Promise<void> {
  const fields: unknown[] = [mode, username ?? null, id];
  let passwordSql = "credential_password=credential_password";
  if (password !== undefined) {
    fields.splice(2, 0, password ? encryptSecret(password) : null);
    passwordSql = "credential_password=$3";
  }
  const idIndex = fields.length;
  await pool.query(`UPDATE devices SET credential_mode=$1,credential_username=$2,${passwordSql},updated_at=now() WHERE id=$${idIndex}`, fields);
}

export async function listRooms(): Promise<Room[]> {
  const result = await pool.query(`SELECT id,name,icon,sort_order as "sortOrder",created_at as "createdAt",updated_at as "updatedAt" FROM rooms ORDER BY sort_order,name`);
  return result.rows;
}

export async function createRoom(name: string, icon: string, sortOrder: number): Promise<Room> {
  const result=await pool.query(`INSERT INTO rooms(id,name,icon,sort_order) VALUES($1,$2,$3,$4) RETURNING id,name,icon,sort_order as "sortOrder",created_at as "createdAt",updated_at as "updatedAt"`,[randomUUID(),name,icon,sortOrder]);
  return result.rows[0];
}

export async function updateRoom(id: string, name: string, icon: string, sortOrder: number): Promise<Room | undefined> {
  const result=await pool.query(`
    UPDATE rooms
    SET name=$2,icon=$3,sort_order=$4,updated_at=now()
    WHERE id=$1
    RETURNING id,name,icon,sort_order as "sortOrder",created_at as "createdAt",updated_at as "updatedAt"
  `,[id,name,icon,sortOrder]);
  return result.rows[0];
}

export async function reorderRooms(roomIds: string[]): Promise<Room[]> {
  if (new Set(roomIds).size !== roomIds.length) throw new Error("INVALID_ROOM_ORDER");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ id: string }>("SELECT id FROM rooms ORDER BY sort_order,name FOR UPDATE");
    const currentIds = new Set(current.rows.map(row => row.id));
    if (roomIds.length !== currentIds.size || roomIds.some(id => !currentIds.has(id))) throw new Error("INVALID_ROOM_ORDER");
    await client.query(`
      UPDATE rooms AS room
      SET sort_order = CAST(ordering.position - 1 AS integer),
          updated_at = now()
      FROM unnest($1::uuid[]) WITH ORDINALITY AS ordering(id, position)
      WHERE room.id = ordering.id
    `, [roomIds]);
    await client.query("COMMIT");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* Preserve the original transaction error. */ }
    throw error;
  } finally {
    client.release();
  }
  return listRooms();
}

export async function deleteRoom(id: string): Promise<boolean> {
  const result=await pool.query("DELETE FROM rooms WHERE id=$1",[id]);
  return result.rowCount === 1;
}

export interface CredentialEncryptionStatus {
  status: "ok" | "invalid";
  globalCredential: "ok" | "invalid" | "not-configured";
  invalidDeviceIds: string[];
}

function secretIsReadable(value: string): boolean {
  if (!value) return true;
  try {
    decryptSecret(value);
    return true;
  } catch {
    return false;
  }
}


export async function inspectCredentialEncryption(): Promise<CredentialEncryptionStatus> {
  const [globalResult, deviceResult] = await Promise.all([
    pool.query<{ encrypted_password: string }>("SELECT encrypted_password FROM adapter_settings WHERE adapter_id='shelly'"),
    pool.query<{ id: string; credential_password: string }>("SELECT id,credential_password FROM devices WHERE credential_mode='custom' AND credential_password IS NOT NULL AND credential_password <> ''")
  ]);
  const globalSecret = globalResult.rows[0]?.encrypted_password ?? "";
  const globalCredential = !globalSecret ? "not-configured" : secretIsReadable(globalSecret) ? "ok" : "invalid";
  const invalidDeviceIds = deviceResult.rows.filter(row => !secretIsReadable(row.credential_password)).map(row => row.id);
  return {
    status: globalCredential === "invalid" || invalidDeviceIds.length > 0 ? "invalid" : "ok",
    globalCredential,
    invalidDeviceIds
  };
}

export async function getShellySettings(): Promise<ShellySettings> {
  const [result, encryption] = await Promise.all([
    pool.query("SELECT username,(encrypted_password <> '') as \"passwordConfigured\" FROM adapter_settings WHERE adapter_id='shelly'"),
    inspectCredentialEncryption()
  ]);
  const current = result.rows[0] ?? { username: "", passwordConfigured: false };
  return {
    username: current.username,
    passwordConfigured: current.passwordConfigured,
    encryptionStatus: encryption.status,
    invalidDeviceCredentials: encryption.invalidDeviceIds.length
  };
}

export async function updateShellySettings(username: string, password?: string): Promise<ShellySettings> {
  const current=await pool.query("SELECT encrypted_password FROM adapter_settings WHERE adapter_id='shelly'");
  const currentSecret = current.rows[0]?.encrypted_password ?? "";
  if (password === undefined && currentSecret && !secretIsReadable(currentSecret)) throw new Error("ENCRYPTION_KEY_MISMATCH");
  const encrypted=password === undefined ? currentSecret : (password ? encryptSecret(password) : "");
  await pool.query(`INSERT INTO adapter_settings(adapter_id,username,encrypted_password) VALUES('shelly',$1,$2)
    ON CONFLICT(adapter_id) DO UPDATE SET username=EXCLUDED.username,encrypted_password=EXCLUDED.encrypted_password,updated_at=now()`,[username,encrypted]);
  return getShellySettings();
}

function decryptStoredSecret(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return decryptSecret(value);
  } catch {
    throw new Error("ENCRYPTION_KEY_MISMATCH");
  }
}

export async function getDeviceCredentials(id: string): Promise<{username:string;password:string}> {
  const result=await pool.query(`SELECT d.credential_mode,d.credential_username,d.credential_password,a.username as global_username,a.encrypted_password as global_password FROM devices d LEFT JOIN adapter_settings a ON a.adapter_id='shelly' WHERE d.id=$1`,[id]);
  const row=result.rows[0]; if(!row) return {username:"",password:""};
  if(row.credential_mode==='none') return {username:"",password:""};
  if(row.credential_mode==='custom') return {username:row.credential_username??"",password:decryptStoredSecret(row.credential_password)};
  return {username:row.global_username??"",password:decryptStoredSecret(row.global_password)};
}

export async function getGlobalShellyCredentials(): Promise<{username:string;password:string}> {
  const result=await pool.query("SELECT username,encrypted_password FROM adapter_settings WHERE adapter_id='shelly'"); const row=result.rows[0];
  return {username:row?.username??"",password:decryptStoredSecret(row?.encrypted_password)};
}
