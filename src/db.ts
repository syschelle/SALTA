import pg from "pg";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { decryptSecret, encryptSecret } from "./security/secrets.js";
import type { CredentialMode, Device, Room, ShellySettings } from "./types.js";
const { Pool } = pg;
export const pool = new Pool({ connectionString: config.DATABASE_URL, max: 10 });

export async function migrate(): Promise<void> {
  await pool.query(`
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
      name text NOT NULL,
      host text,
      generation text,
      model text,
      room text,
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
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS host text;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS generation text;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS model text;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS firmware_version text;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS hostname text;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS mac_address text;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS profile text;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS component_kind text;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS component_id integer;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS channel_count integer;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS power_metering boolean;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS cover_support boolean;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS switch_support boolean;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS light_support boolean;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS input_support boolean;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES rooms(id) ON DELETE SET NULL;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS credential_mode text NOT NULL DEFAULT 'inherit';
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS credential_username text;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS credential_password text;
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

  const legacyRooms = await pool.query<{ room: string }>("SELECT DISTINCT room FROM devices WHERE room IS NOT NULL AND room <> ''");
  for (const row of legacyRooms.rows) {
    await pool.query("INSERT INTO rooms(id,name) VALUES($1,$2) ON CONFLICT(name) DO NOTHING", [randomUUID(), row.room]);
  }
  await pool.query(`UPDATE devices d SET room_id=r.id FROM rooms r WHERE d.room_id IS NULL AND d.room=r.name`);
  await pool.query("DELETE FROM devices WHERE source='mock'");
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
    (id,source,source_id,type,name,host,generation,model,firmware_version,hostname,mac_address,profile,component_kind,component_id,channel_count,power_metering,cover_support,switch_support,light_support,input_support,room,room_id,reachable,state,capabilities,homekit_enabled,credential_mode,credential_username,last_seen,last_event,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,now())
    ON CONFLICT (id) DO UPDATE SET source=EXCLUDED.source, source_id=EXCLUDED.source_id, type=EXCLUDED.type, name=EXCLUDED.name,
    host=EXCLUDED.host, generation=EXCLUDED.generation, model=EXCLUDED.model, firmware_version=EXCLUDED.firmware_version,
    hostname=EXCLUDED.hostname, mac_address=EXCLUDED.mac_address, profile=EXCLUDED.profile, component_kind=EXCLUDED.component_kind, component_id=EXCLUDED.component_id,
    channel_count=EXCLUDED.channel_count, power_metering=EXCLUDED.power_metering, cover_support=EXCLUDED.cover_support,
    switch_support=EXCLUDED.switch_support, light_support=EXCLUDED.light_support, input_support=EXCLUDED.input_support,
    room=EXCLUDED.room, room_id=EXCLUDED.room_id, reachable=EXCLUDED.reachable, state=EXCLUDED.state,
    capabilities=EXCLUDED.capabilities, homekit_enabled=EXCLUDED.homekit_enabled, credential_mode=EXCLUDED.credential_mode,
    credential_username=EXCLUDED.credential_username, last_seen=EXCLUDED.last_seen, last_event=EXCLUDED.last_event, updated_at=now()`,
    [d.id,d.source,d.sourceId,d.type,d.name,d.host??null,d.generation??null,d.model??null,d.firmwareVersion??null,d.hostname??null,d.macAddress??null,d.profile??null,d.componentKind??null,d.componentId??null,d.channelCount??null,d.powerMetering??null,d.coverSupport??null,d.switchSupport??null,d.lightSupport??null,d.inputSupport??null,d.room??null,roomId,d.reachable,JSON.stringify(d.state),JSON.stringify(d.capabilities),d.homekitEnabled,d.credentialMode,d.credentialUsername??null,d.lastSeen,d.lastEvent]);
}

export async function deleteDevice(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM devices WHERE id=$1", [id]);
  return result.rowCount === 1;
}

export async function listDevices(): Promise<Device[]> {
  const r=await pool.query(`SELECT d.id,d.source,d.source_id as "sourceId",d.type,d.name,d.host,d.generation,d.model,
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
  const result=await pool.query(`UPDATE rooms SET name=$2,icon=$3,sort_order=$4,updated_at=now() WHERE id=$1 RETURNING id,name,icon,sort_order as "sortOrder",created_at as "createdAt",updated_at as "updatedAt"`,[id,name,icon,sortOrder]);
  return result.rows[0];
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

export async function upgradeCredentialEncryption(): Promise<void> {
  const globalResult = await pool.query<{ encrypted_password: string }>("SELECT encrypted_password FROM adapter_settings WHERE adapter_id='shelly'");
  const globalSecret = globalResult.rows[0]?.encrypted_password ?? "";
  if (globalSecret.startsWith("v1.")) {
    try {
      await pool.query("UPDATE adapter_settings SET encrypted_password=$1,updated_at=now() WHERE adapter_id='shelly'", [encryptSecret(decryptSecret(globalSecret))]);
    } catch {
      // The startup validation reports a mismatching key without destroying the stored secret.
    }
  }

  const deviceResult = await pool.query<{ id: string; credential_password: string }>("SELECT id,credential_password FROM devices WHERE credential_mode='custom' AND credential_password LIKE 'v1.%'");
  for (const row of deviceResult.rows) {
    try {
      await pool.query("UPDATE devices SET credential_password=$2,updated_at=now() WHERE id=$1", [row.id, encryptSecret(decryptSecret(row.credential_password))]);
    } catch {
      // Keep unreadable values intact so the UI can ask the user to replace them.
    }
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
