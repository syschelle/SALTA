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
    (id,source,source_id,type,name,host,generation,model,room,room_id,reachable,state,capabilities,homekit_enabled,credential_mode,credential_username,last_seen,last_event,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, host=EXCLUDED.host, generation=EXCLUDED.generation, model=EXCLUDED.model, room=EXCLUDED.room, room_id=EXCLUDED.room_id, reachable=EXCLUDED.reachable,
    state=EXCLUDED.state, capabilities=EXCLUDED.capabilities, homekit_enabled=EXCLUDED.homekit_enabled,
    credential_mode=EXCLUDED.credential_mode, credential_username=EXCLUDED.credential_username,
    last_seen=EXCLUDED.last_seen, last_event=EXCLUDED.last_event, updated_at=now()`,
    [d.id,d.source,d.sourceId,d.type,d.name,d.host??null,d.generation??null,d.model??null,d.room??null,roomId,d.reachable,JSON.stringify(d.state),JSON.stringify(d.capabilities),d.homekitEnabled,d.credentialMode,d.credentialUsername??null,d.lastSeen,d.lastEvent]);
}

export async function listDevices(): Promise<Device[]> {
  const r=await pool.query(`SELECT d.id,d.source,d.source_id as "sourceId",d.type,d.name,d.host,d.generation,d.model,d.room_id as "roomId",r.name as room,d.reachable,d.state,d.capabilities,
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

export async function getShellySettings(): Promise<ShellySettings> {
  const result=await pool.query("SELECT username,(encrypted_password <> '') as \"passwordConfigured\" FROM adapter_settings WHERE adapter_id='shelly'");
  return result.rows[0] ?? { username: "", passwordConfigured: false };
}

export async function updateShellySettings(username: string, password?: string): Promise<ShellySettings> {
  const current=await pool.query("SELECT encrypted_password FROM adapter_settings WHERE adapter_id='shelly'");
  const encrypted=password === undefined ? (current.rows[0]?.encrypted_password ?? "") : (password ? encryptSecret(password) : "");
  await pool.query(`INSERT INTO adapter_settings(adapter_id,username,encrypted_password) VALUES('shelly',$1,$2)
    ON CONFLICT(adapter_id) DO UPDATE SET username=EXCLUDED.username,encrypted_password=EXCLUDED.encrypted_password,updated_at=now()`,[username,encrypted]);
  return { username, passwordConfigured: Boolean(encrypted) };
}

export async function getDeviceCredentials(id: string): Promise<{username:string;password:string}> {
  const result=await pool.query(`SELECT d.credential_mode,d.credential_username,d.credential_password,a.username as global_username,a.encrypted_password as global_password FROM devices d LEFT JOIN adapter_settings a ON a.adapter_id='shelly' WHERE d.id=$1`,[id]);
  const row=result.rows[0]; if(!row) return {username:"",password:""};
  if(row.credential_mode==='none') return {username:"",password:""};
  if(row.credential_mode==='custom') return {username:row.credential_username??"",password:row.credential_password?decryptSecret(row.credential_password):""};
  return {username:row.global_username??"",password:row.global_password?decryptSecret(row.global_password):""};
}

export async function getGlobalShellyCredentials(): Promise<{username:string;password:string}> {
  const result=await pool.query("SELECT username,encrypted_password FROM adapter_settings WHERE adapter_id='shelly'"); const row=result.rows[0];
  return {username:row?.username??"",password:row?.encrypted_password?decryptSecret(row.encrypted_password):""};
}
