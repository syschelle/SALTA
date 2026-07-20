import pg from "pg";
import { config } from "./config.js";
import type { Device } from "./types.js";
const { Pool } = pg;
export const pool = new Pool({ connectionString: config.DATABASE_URL, max: 10 });

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id text PRIMARY KEY,
      source text NOT NULL,
      source_id text NOT NULL,
      type text NOT NULL,
      name text NOT NULL,
      room text,
      reachable boolean NOT NULL DEFAULT true,
      state jsonb NOT NULL DEFAULT '{}'::jsonb,
      capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
      homekit_enabled boolean NOT NULL DEFAULT true,
      last_seen timestamptz NOT NULL DEFAULT now(),
      last_event timestamptz NOT NULL DEFAULT now(),
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
  await pool.query(`INSERT INTO devices
    (id,source,source_id,type,name,room,reachable,state,capabilities,homekit_enabled,last_seen,last_event,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, room=EXCLUDED.room, reachable=EXCLUDED.reachable,
    state=EXCLUDED.state, capabilities=EXCLUDED.capabilities, homekit_enabled=EXCLUDED.homekit_enabled,
    last_seen=EXCLUDED.last_seen, last_event=EXCLUDED.last_event, updated_at=now()`,
    [d.id,d.source,d.sourceId,d.type,d.name,d.room??null,d.reachable,JSON.stringify(d.state),JSON.stringify(d.capabilities),d.homekitEnabled,d.lastSeen,d.lastEvent]);
}

export async function listDevices(): Promise<Device[]> {
  const r=await pool.query(`SELECT id,source,source_id as "sourceId",type,name,room,reachable,state,capabilities,homekit_enabled as "homekitEnabled",last_seen as "lastSeen",last_event as "lastEvent" FROM devices ORDER BY name`);
  return r.rows;
}
