import pg from "pg";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { decryptSecret, encryptSecret } from "./security/secrets.js";
import type { ClimateModeSettings, CredentialMode, Device, FritzBoxPresenceSettings, OpenCcuSettings, PhosconSettings, PresenceTarget, PushoverSettings, Room, ShellySettings, SystemLogEntry, SystemLogLevel } from "./types.js";
import type { AutomationInput, AutomationRule } from "./automations.js";
const { Pool } = pg;
export const pool = new Pool({ connectionString: config.DATABASE_URL, max: 10 });

const DATABASE_SCHEMA_VERSION = "0.5";

export async function initializeDatabaseSchema(): Promise<void> {
  const existing = await pool.query<{ devices: string | null; metadata: string | null }>(
    "SELECT to_regclass('public.devices')::text AS devices, to_regclass('public.salta_metadata')::text AS metadata"
  );
  const state = existing.rows[0];
  if (state?.devices && !state.metadata) {
    throw new Error("INCOMPATIBLE_DATABASE_SCHEMA: this SALTA release requires a fresh PostgreSQL volume");
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
    CREATE TABLE IF NOT EXISTS device_preferences (
      device_id text PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
      hidden boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS device_homekit_settings (
      device_id text PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
      enabled boolean NOT NULL DEFAULT true,
      name_override text,
      use_salta_room boolean NOT NULL DEFAULT true,
      room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO device_homekit_settings(device_id,enabled)
    SELECT id,homekit_enabled FROM devices
    ON CONFLICT(device_id) DO NOTHING;
    CREATE TABLE IF NOT EXISTS adapter_settings (
      adapter_id text PRIMARY KEY,
      username text NOT NULL DEFAULT '',
      encrypted_password text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS openccu_settings (
      adapter_id text PRIMARY KEY DEFAULT 'openccu',
      base_url text NOT NULL DEFAULT '',
      username text NOT NULL DEFAULT '',
      encrypted_password text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS fritzbox_presence_settings (
      adapter_id text PRIMARY KEY DEFAULT 'fritzbox_presence',
      base_url text NOT NULL DEFAULT 'http://fritz.box:49000',
      username text NOT NULL DEFAULT '',
      encrypted_password text NOT NULL DEFAULT '',
      enabled boolean NOT NULL DEFAULT false,
      poll_interval_seconds integer NOT NULL DEFAULT 30 CHECK (poll_interval_seconds BETWEEN 10 AND 3600),
      absence_delay_seconds integer NOT NULL DEFAULT 300 CHECK (absence_delay_seconds BETWEEN 0 AND 86400),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS fritzbox_presence_transport_settings (
      adapter_id text PRIMARY KEY DEFAULT 'fritzbox_presence',
      tls_insecure boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS presence_targets (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      mac_address text NOT NULL UNIQUE,
      absence_delay_seconds integer CHECK (absence_delay_seconds IS NULL OR absence_delay_seconds BETWEEN 0 AND 86400),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS device_adapter_data (
      device_id text PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
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
    CREATE TABLE IF NOT EXISTS automations (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      trigger_device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      trigger_state_key text NOT NULL,
      trigger_value boolean NOT NULL,
      condition_device_id text REFERENCES devices(id) ON DELETE CASCADE,
      condition_state_key text,
      condition_value boolean,
      action_device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      action text NOT NULL CHECK(action IN ('turnOn','turnOff','toggle')),
      last_triggered_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((condition_device_id IS NULL AND condition_state_key IS NULL AND condition_value IS NULL) OR
             (condition_device_id IS NOT NULL AND condition_state_key IS NOT NULL AND condition_value IS NOT NULL))
    );
    CREATE TABLE IF NOT EXISTS automation_preferences (
      automation_id uuid PRIMARY KEY REFERENCES automations(id) ON DELETE CASCADE,
      room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS automation_preferences_room_idx ON automation_preferences(room_id);
    CREATE TABLE IF NOT EXISTS automation_triggers (
      automation_id uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
      position smallint NOT NULL CHECK(position BETWEEN 1 AND 7),
      trigger_device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      trigger_state_key text NOT NULL,
      trigger_value boolean NOT NULL,
      PRIMARY KEY(automation_id,position)
    );
    CREATE INDEX IF NOT EXISTS automation_triggers_device_idx ON automation_triggers(trigger_device_id,automation_id);
    CREATE INDEX IF NOT EXISTS automations_trigger_idx ON automations(trigger_device_id, enabled);
    CREATE INDEX IF NOT EXISTS automations_action_idx ON automations(action_device_id);
    CREATE TABLE IF NOT EXISTS climate_mode_settings (
      id text PRIMARY KEY DEFAULT 'global',
      mode text NOT NULL DEFAULT 'winter' CHECK(mode IN ('summer','winter')),
      winter_mode text NOT NULL DEFAULT 'auto' CHECK(winter_mode IN ('manual','auto')),
      last_applied_at timestamptz,
      last_result jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO climate_mode_settings(id) VALUES('global') ON CONFLICT(id) DO NOTHING;
    CREATE TABLE IF NOT EXISTS notification_settings (
      channel text PRIMARY KEY DEFAULT 'pushover',
      enabled boolean NOT NULL DEFAULT false,
      encrypted_user_key text NOT NULL DEFAULT '',
      encrypted_api_token text NOT NULL DEFAULT '',
      battery_threshold integer NOT NULL DEFAULT 20 CHECK(battery_threshold BETWEEN 1 AND 100),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO notification_settings(channel) VALUES('pushover') ON CONFLICT(channel) DO NOTHING;
    CREATE TABLE IF NOT EXISTS notification_state (
      key text PRIMARY KEY,
      last_sent_at timestamptz,
      details jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS system_logs (
      id uuid PRIMARY KEY,
      level text NOT NULL CHECK(level IN ('info','warning','error')),
      source text NOT NULL,
      code text,
      message text NOT NULL,
      details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS system_logs_created_idx ON system_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS system_logs_source_idx ON system_logs(source, created_at DESC);
    DELETE FROM system_logs WHERE created_at < now() - interval '30 days';
    DELETE FROM system_logs WHERE id IN (SELECT id FROM system_logs ORDER BY created_at DESC, id DESC OFFSET 2000);
  `);
}

export async function upsertDevice(d: Device): Promise<void> {
  const roomId = d.roomId ?? null;
  await pool.query(`WITH upserted_device AS (
    INSERT INTO devices
      (id,source,source_id,type,presentation_type,name,host,generation,model,firmware_version,hostname,mac_address,profile,component_kind,component_id,channel_count,power_metering,cover_support,switch_support,light_support,input_support,room_id,reachable,state,capabilities,homekit_enabled,credential_mode,credential_username,last_seen,last_event,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,now())
    ON CONFLICT (id) DO UPDATE SET source=EXCLUDED.source, source_id=EXCLUDED.source_id, type=EXCLUDED.type, presentation_type=EXCLUDED.presentation_type, name=EXCLUDED.name,
      host=EXCLUDED.host, generation=EXCLUDED.generation, model=EXCLUDED.model, firmware_version=EXCLUDED.firmware_version,
      hostname=EXCLUDED.hostname, mac_address=EXCLUDED.mac_address, profile=EXCLUDED.profile, component_kind=EXCLUDED.component_kind, component_id=EXCLUDED.component_id,
      channel_count=EXCLUDED.channel_count, power_metering=EXCLUDED.power_metering, cover_support=EXCLUDED.cover_support,
      switch_support=EXCLUDED.switch_support, light_support=EXCLUDED.light_support, input_support=EXCLUDED.input_support,
      room_id=EXCLUDED.room_id, reachable=EXCLUDED.reachable, state=EXCLUDED.state,
      capabilities=EXCLUDED.capabilities, homekit_enabled=EXCLUDED.homekit_enabled, credential_mode=EXCLUDED.credential_mode,
      credential_username=EXCLUDED.credential_username, last_seen=EXCLUDED.last_seen, last_event=EXCLUDED.last_event, updated_at=now()
    RETURNING id
  ), upserted_preferences AS (
    INSERT INTO device_preferences(device_id,hidden)
    SELECT id,$31 FROM upserted_device
    ON CONFLICT(device_id) DO UPDATE SET hidden=EXCLUDED.hidden,updated_at=now()
    RETURNING device_id
  )
  INSERT INTO device_adapter_data(device_id,data)
  SELECT device_id,$32::jsonb FROM upserted_preferences
  ON CONFLICT(device_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`,
    [d.id,d.source,d.sourceId,d.type,d.presentationType??"auto",d.name,d.host??null,d.generation??null,d.model??null,d.firmwareVersion??null,d.hostname??null,d.macAddress??null,d.profile??null,d.componentKind??null,d.componentId??null,d.channelCount??null,d.powerMetering??null,d.coverSupport??null,d.switchSupport??null,d.lightSupport??null,d.inputSupport??null,roomId,d.reachable,JSON.stringify(d.state),JSON.stringify(d.capabilities),d.homekitEnabled,d.credentialMode,d.credentialUsername??null,d.lastSeen,d.lastEvent,d.hidden,JSON.stringify(d.adapterData??{})]);
  await pool.query(`INSERT INTO device_homekit_settings(device_id,enabled) VALUES($1,$2) ON CONFLICT(device_id) DO NOTHING`,[d.id,d.homekitEnabled]);
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
    COALESCE(hk.enabled,d.homekit_enabled) as "homekitEnabled",NULLIF(hk.name_override,'') as "homekitName",
    COALESCE(hk.use_salta_room,true) as "homekitUseSaltaRoom",
    CASE WHEN COALESCE(hk.use_salta_room,true) THEN d.room_id ELSE hk.room_id END as "homekitRoomId",
    CASE WHEN COALESCE(hk.use_salta_room,true) THEN r.name ELSE hkr.name END as "homekitRoom",
    COALESCE(p.hidden,false) as hidden,d.credential_mode as "credentialMode",d.credential_username as "credentialUsername",
    (d.credential_password IS NOT NULL AND d.credential_password <> '') as "passwordConfigured",
    d.last_seen as "lastSeen",d.last_event as "lastEvent",COALESCE(ad.data,'{}'::jsonb) as "adapterData"
    FROM devices d
    LEFT JOIN rooms r ON r.id=d.room_id
    LEFT JOIN device_preferences p ON p.device_id=d.id
    LEFT JOIN device_homekit_settings hk ON hk.device_id=d.id
    LEFT JOIN rooms hkr ON hkr.id=hk.room_id
    LEFT JOIN device_adapter_data ad ON ad.device_id=d.id
    ORDER BY d.name`);
  return r.rows;
}

export async function updateDeviceHomeKitSettings(id: string, settings: { enabled: boolean; name?: string; useSaltaRoom: boolean; roomId?: string }): Promise<void> {
  await pool.query(`WITH updated_device AS (
    UPDATE devices SET homekit_enabled=$2,updated_at=now() WHERE id=$1 RETURNING id
  )
  INSERT INTO device_homekit_settings(device_id,enabled,name_override,use_salta_room,room_id,updated_at)
  SELECT id,$2,$3,$4,$5,now() FROM updated_device
  ON CONFLICT(device_id) DO UPDATE SET enabled=EXCLUDED.enabled,name_override=EXCLUDED.name_override,use_salta_room=EXCLUDED.use_salta_room,room_id=EXCLUDED.room_id,updated_at=now()`,
  [id,settings.enabled,settings.name?.trim()||null,settings.useSaltaRoom,settings.useSaltaRoom?null:(settings.roomId??null)]);
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

function automationDate(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function automationRow(row: Record<string, unknown>): AutomationRule {
  const additionalTriggers = Array.isArray(row.additionalTriggers)
    ? row.additionalTriggers.flatMap(value => {
        if (!value || typeof value !== "object") return [];
        const trigger = value as Record<string, unknown>;
        if (!trigger.deviceId || !trigger.stateKey || typeof trigger.value !== "boolean") return [];
        return [{ deviceId: String(trigger.deviceId), stateKey: String(trigger.stateKey), value: trigger.value }];
      })
    : [];
  return {
    id: String(row.id),
    name: String(row.name),
    enabled: Boolean(row.enabled),
    roomId: row.roomId ? String(row.roomId) : undefined,
    triggerDeviceId: String(row.triggerDeviceId),
    triggerStateKey: String(row.triggerStateKey),
    triggerValue: Boolean(row.triggerValue),
    additionalTriggers,
    conditionDeviceId: row.conditionDeviceId ? String(row.conditionDeviceId) : undefined,
    conditionStateKey: row.conditionStateKey ? String(row.conditionStateKey) : undefined,
    conditionValue: typeof row.conditionValue === "boolean" ? row.conditionValue : undefined,
    actionDeviceId: String(row.actionDeviceId),
    action: row.action as AutomationRule["action"],
    lastTriggeredAt: row.lastTriggeredAt ? automationDate(row.lastTriggeredAt) : undefined,
    createdAt: automationDate(row.createdAt),
    updatedAt: automationDate(row.updatedAt)
  };
}

const automationColumns = `a.id,a.name,a.enabled,p.room_id as "roomId",a.trigger_device_id as "triggerDeviceId",a.trigger_state_key as "triggerStateKey",a.trigger_value as "triggerValue",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('deviceId',t.trigger_device_id,'stateKey',t.trigger_state_key,'value',t.trigger_value) ORDER BY t.position) FROM automation_triggers t WHERE t.automation_id=a.id),'[]'::jsonb) as "additionalTriggers",
  a.condition_device_id as "conditionDeviceId",a.condition_state_key as "conditionStateKey",a.condition_value as "conditionValue",
  a.action_device_id as "actionDeviceId",a.action,a.last_triggered_at as "lastTriggeredAt",a.created_at as "createdAt",a.updated_at as "updatedAt"`;

export async function listAutomations(): Promise<AutomationRule[]> {
  const result = await pool.query(`SELECT ${automationColumns}
    FROM automations a
    LEFT JOIN automation_preferences p ON p.automation_id=a.id
    ORDER BY a.name,a.id`);
  return result.rows.map(row => automationRow(row));
}

export async function createAutomation(input: AutomationInput): Promise<AutomationRule> {
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO automations(id,name,enabled,trigger_device_id,trigger_state_key,trigger_value,condition_device_id,condition_state_key,condition_value,action_device_id,action)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id,input.name,input.enabled,input.triggerDeviceId,input.triggerStateKey,input.triggerValue,input.conditionDeviceId??null,input.conditionStateKey??null,input.conditionValue??null,input.actionDeviceId,input.action]);
    await client.query(`INSERT INTO automation_preferences(automation_id,room_id) VALUES($1,$2)
      ON CONFLICT(automation_id) DO UPDATE SET room_id=EXCLUDED.room_id,updated_at=now()`, [id,input.roomId??null]);
    for (const [index, trigger] of (input.additionalTriggers ?? []).entries()) {
      await client.query(`INSERT INTO automation_triggers(automation_id,position,trigger_device_id,trigger_state_key,trigger_value) VALUES($1,$2,$3,$4,$5)`,
        [id,index+1,trigger.deviceId,trigger.stateKey,trigger.value]);
    }
    const result = await client.query(`SELECT ${automationColumns} FROM automations a LEFT JOIN automation_preferences p ON p.automation_id=a.id WHERE a.id=$1`, [id]);
    await client.query("COMMIT");
    return automationRow(result.rows[0]);
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* Preserve the original transaction error. */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAutomation(id: string, input: AutomationInput): Promise<AutomationRule | undefined> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const changed = await client.query(`UPDATE automations SET name=$2,enabled=$3,trigger_device_id=$4,trigger_state_key=$5,trigger_value=$6,
      condition_device_id=$7,condition_state_key=$8,condition_value=$9,action_device_id=$10,action=$11,updated_at=now()
      WHERE id=$1 RETURNING id`,
      [id,input.name,input.enabled,input.triggerDeviceId,input.triggerStateKey,input.triggerValue,input.conditionDeviceId??null,input.conditionStateKey??null,input.conditionValue??null,input.actionDeviceId,input.action]);
    if (!changed.rows[0]) {
      await client.query("ROLLBACK");
      return undefined;
    }
    await client.query(`INSERT INTO automation_preferences(automation_id,room_id) VALUES($1,$2)
      ON CONFLICT(automation_id) DO UPDATE SET room_id=EXCLUDED.room_id,updated_at=now()`, [id,input.roomId??null]);
    await client.query("DELETE FROM automation_triggers WHERE automation_id=$1", [id]);
    for (const [index, trigger] of (input.additionalTriggers ?? []).entries()) {
      await client.query(`INSERT INTO automation_triggers(automation_id,position,trigger_device_id,trigger_state_key,trigger_value) VALUES($1,$2,$3,$4,$5)`,
        [id,index+1,trigger.deviceId,trigger.stateKey,trigger.value]);
    }
    const result = await client.query(`SELECT ${automationColumns} FROM automations a LEFT JOIN automation_preferences p ON p.automation_id=a.id WHERE a.id=$1`, [id]);
    await client.query("COMMIT");
    return result.rows[0] ? automationRow(result.rows[0]) : undefined;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* Preserve the original transaction error. */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteAutomation(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM automations WHERE id=$1", [id]);
  return result.rowCount === 1;
}

export async function markAutomationTriggered(id: string, triggeredAt: string): Promise<void> {
  await pool.query("UPDATE automations SET last_triggered_at=$2,updated_at=now() WHERE id=$1", [id, triggeredAt]);
}

interface CredentialEncryptionStatus {
  status: "ok" | "invalid";
  globalCredential: "ok" | "invalid" | "not-configured";
  phosconCredential: "ok" | "invalid" | "not-configured";
  openCcuCredential: "ok" | "invalid" | "not-configured";
  pushoverCredential: "ok" | "invalid" | "not-configured";
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
  const [globalResult, phosconResult, openCcuResult, pushoverResult, deviceResult] = await Promise.all([
    pool.query<{ encrypted_password: string }>("SELECT encrypted_password FROM adapter_settings WHERE adapter_id='shelly'"),
    pool.query<{ encrypted_password: string }>("SELECT encrypted_password FROM adapter_settings WHERE adapter_id='phoscon'"),
    pool.query<{ encrypted_password: string }>("SELECT encrypted_password FROM openccu_settings WHERE adapter_id='openccu'"),
    pool.query<{ encrypted_user_key: string; encrypted_api_token: string }>("SELECT encrypted_user_key,encrypted_api_token FROM notification_settings WHERE channel='pushover'"),
    pool.query<{ id: string; credential_password: string }>("SELECT id,credential_password FROM devices WHERE credential_mode='custom' AND credential_password IS NOT NULL AND credential_password <> ''")
  ]);
  const globalSecret = globalResult.rows[0]?.encrypted_password ?? "";
  const phosconSecret = phosconResult.rows[0]?.encrypted_password ?? "";
  const openCcuSecret = openCcuResult.rows[0]?.encrypted_password ?? "";
  const pushoverUserSecret = pushoverResult.rows[0]?.encrypted_user_key ?? "";
  const pushoverTokenSecret = pushoverResult.rows[0]?.encrypted_api_token ?? "";
  const globalCredential = !globalSecret ? "not-configured" : secretIsReadable(globalSecret) ? "ok" : "invalid";
  const phosconCredential = !phosconSecret ? "not-configured" : secretIsReadable(phosconSecret) ? "ok" : "invalid";
  const openCcuCredential = !openCcuSecret ? "not-configured" : secretIsReadable(openCcuSecret) ? "ok" : "invalid";
  const pushoverConfigured = Boolean(pushoverUserSecret || pushoverTokenSecret);
  const pushoverCredential = !pushoverConfigured ? "not-configured" : secretIsReadable(pushoverUserSecret) && secretIsReadable(pushoverTokenSecret) ? "ok" : "invalid";
  const invalidDeviceIds = deviceResult.rows.filter(row => !secretIsReadable(row.credential_password)).map(row => row.id);
  return {
    status: globalCredential === "invalid" || phosconCredential === "invalid" || openCcuCredential === "invalid" || pushoverCredential === "invalid" || invalidDeviceIds.length > 0 ? "invalid" : "ok",
    globalCredential,
    phosconCredential,
    openCcuCredential,
    pushoverCredential,
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
    encryptionStatus: encryption.globalCredential === "invalid" || encryption.invalidDeviceIds.length > 0 ? "invalid" : "ok",
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


export async function getPhosconSettings(): Promise<PhosconSettings> {
  const result = await pool.query<{ username: string; encrypted_password: string }>(
    "SELECT username,encrypted_password FROM adapter_settings WHERE adapter_id='phoscon'"
  );
  const row = result.rows[0];
  const secret = row?.encrypted_password ?? "";
  return {
    baseUrl: row?.username ?? "",
    apiKeyConfigured: Boolean(secret),
    encryptionStatus: secret && !secretIsReadable(secret) ? "invalid" : "ok"
  };
}

export async function getPhosconConnection(): Promise<{ baseUrl: string; apiKey: string }> {
  const result = await pool.query<{ username: string; encrypted_password: string }>(
    "SELECT username,encrypted_password FROM adapter_settings WHERE adapter_id='phoscon'"
  );
  const row = result.rows[0];
  return {
    baseUrl: row?.username ?? "",
    apiKey: decryptStoredSecret(row?.encrypted_password)
  };
}

export async function updatePhosconSettings(baseUrl: string, apiKey?: string): Promise<PhosconSettings> {
  const current = await pool.query<{ encrypted_password: string }>(
    "SELECT encrypted_password FROM adapter_settings WHERE adapter_id='phoscon'"
  );
  const currentSecret = current.rows[0]?.encrypted_password ?? "";
  if (apiKey === undefined && currentSecret && !secretIsReadable(currentSecret)) throw new Error("ENCRYPTION_KEY_MISMATCH");
  const encrypted = apiKey === undefined ? currentSecret : (apiKey ? encryptSecret(apiKey) : "");
  await pool.query(`INSERT INTO adapter_settings(adapter_id,username,encrypted_password) VALUES('phoscon',$1,$2)
    ON CONFLICT(adapter_id) DO UPDATE SET username=EXCLUDED.username,encrypted_password=EXCLUDED.encrypted_password,updated_at=now()`, [baseUrl, encrypted]);
  return getPhosconSettings();
}

export async function clearPhosconSettings(): Promise<void> {
  await pool.query("DELETE FROM adapter_settings WHERE adapter_id='phoscon'");
}

export async function getOpenCcuSettings(): Promise<OpenCcuSettings> {
  const result = await pool.query<{ base_url: string; username: string; encrypted_password: string }>(
    "SELECT base_url,username,encrypted_password FROM openccu_settings WHERE adapter_id='openccu'"
  );
  const row = result.rows[0];
  const secret = row?.encrypted_password ?? "";
  return {
    baseUrl: row?.base_url ?? "",
    username: row?.username ?? "",
    passwordConfigured: Boolean(secret),
    encryptionStatus: secret && !secretIsReadable(secret) ? "invalid" : "ok"
  };
}

export async function getOpenCcuConnection(): Promise<{ baseUrl: string; username: string; password: string }> {
  const result = await pool.query<{ base_url: string; username: string; encrypted_password: string }>(
    "SELECT base_url,username,encrypted_password FROM openccu_settings WHERE adapter_id='openccu'"
  );
  const row = result.rows[0];
  return {
    baseUrl: row?.base_url ?? "",
    username: row?.username ?? "",
    password: decryptStoredSecret(row?.encrypted_password)
  };
}

export async function updateOpenCcuSettings(baseUrl: string, username: string, password?: string): Promise<OpenCcuSettings> {
  const current = await pool.query<{ encrypted_password: string }>(
    "SELECT encrypted_password FROM openccu_settings WHERE adapter_id='openccu'"
  );
  const currentSecret = current.rows[0]?.encrypted_password ?? "";
  if (password === undefined && currentSecret && !secretIsReadable(currentSecret)) throw new Error("ENCRYPTION_KEY_MISMATCH");
  const encrypted = password === undefined ? currentSecret : (password ? encryptSecret(password) : "");
  await pool.query(`INSERT INTO openccu_settings(adapter_id,base_url,username,encrypted_password) VALUES('openccu',$1,$2,$3)
    ON CONFLICT(adapter_id) DO UPDATE SET base_url=EXCLUDED.base_url,username=EXCLUDED.username,encrypted_password=EXCLUDED.encrypted_password,updated_at=now()`, [baseUrl, username, encrypted]);
  return getOpenCcuSettings();
}

export async function clearOpenCcuSettings(): Promise<void> {
  await pool.query("DELETE FROM openccu_settings WHERE adapter_id='openccu'");
}

export async function getFritzBoxPresenceSettings(): Promise<FritzBoxPresenceSettings> {
  const result = await pool.query<{ base_url: string; username: string; encrypted_password: string; enabled: boolean; poll_interval_seconds: number; absence_delay_seconds: number }>(
    "SELECT base_url,username,encrypted_password,enabled,poll_interval_seconds,absence_delay_seconds FROM fritzbox_presence_settings WHERE adapter_id='fritzbox_presence'"
  );
  const transport = await pool.query<{ tls_insecure: boolean }>("SELECT tls_insecure FROM fritzbox_presence_transport_settings WHERE adapter_id='fritzbox_presence'");
  const row = result.rows[0];
  const secret = row?.encrypted_password ?? "";
  return {
    baseUrl: row?.base_url ?? "http://fritz.box:49000",
    username: row?.username ?? "",
    passwordConfigured: Boolean(secret),
    encryptionStatus: secret && !secretIsReadable(secret) ? "invalid" : "ok",
    enabled: row?.enabled ?? false,
    pollIntervalSeconds: row?.poll_interval_seconds ?? 30,
    absenceDelaySeconds: row?.absence_delay_seconds ?? 300,
    tlsInsecure: transport.rows[0]?.tls_insecure ?? false
  };
}

export async function getFritzBoxPresenceConnection(): Promise<{ baseUrl: string; username: string; password: string; enabled: boolean; pollIntervalSeconds: number; absenceDelaySeconds: number; tlsInsecure: boolean }> {
  const result = await pool.query<{ base_url: string; username: string; encrypted_password: string; enabled: boolean; poll_interval_seconds: number; absence_delay_seconds: number }>(
    "SELECT base_url,username,encrypted_password,enabled,poll_interval_seconds,absence_delay_seconds FROM fritzbox_presence_settings WHERE adapter_id='fritzbox_presence'"
  );
  const transport = await pool.query<{ tls_insecure: boolean }>("SELECT tls_insecure FROM fritzbox_presence_transport_settings WHERE adapter_id='fritzbox_presence'");
  const row = result.rows[0];
  return {
    baseUrl: row?.base_url ?? "http://fritz.box:49000",
    username: row?.username ?? "",
    password: decryptStoredSecret(row?.encrypted_password),
    enabled: row?.enabled ?? false,
    pollIntervalSeconds: row?.poll_interval_seconds ?? 30,
    absenceDelaySeconds: row?.absence_delay_seconds ?? 300,
    tlsInsecure: transport.rows[0]?.tls_insecure ?? false
  };
}

export async function updateFritzBoxPresenceSettings(input: { baseUrl: string; username: string; password?: string; enabled: boolean; pollIntervalSeconds: number; absenceDelaySeconds: number; tlsInsecure: boolean }): Promise<FritzBoxPresenceSettings> {
  const current = await pool.query<{ encrypted_password: string }>("SELECT encrypted_password FROM fritzbox_presence_settings WHERE adapter_id='fritzbox_presence'");
  const currentSecret = current.rows[0]?.encrypted_password ?? "";
  if (input.password === undefined && currentSecret && !secretIsReadable(currentSecret)) throw new Error("ENCRYPTION_KEY_MISMATCH");
  const encrypted = input.password === undefined ? currentSecret : (input.password ? encryptSecret(input.password) : "");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO fritzbox_presence_settings(adapter_id,base_url,username,encrypted_password,enabled,poll_interval_seconds,absence_delay_seconds)
      VALUES('fritzbox_presence',$1,$2,$3,$4,$5,$6)
      ON CONFLICT(adapter_id) DO UPDATE SET base_url=EXCLUDED.base_url,username=EXCLUDED.username,encrypted_password=EXCLUDED.encrypted_password,enabled=EXCLUDED.enabled,poll_interval_seconds=EXCLUDED.poll_interval_seconds,absence_delay_seconds=EXCLUDED.absence_delay_seconds,updated_at=now()`,
      [input.baseUrl,input.username,encrypted,input.enabled,input.pollIntervalSeconds,input.absenceDelaySeconds]);
    await client.query(`INSERT INTO fritzbox_presence_transport_settings(adapter_id,tls_insecure) VALUES('fritzbox_presence',$1)
      ON CONFLICT(adapter_id) DO UPDATE SET tls_insecure=EXCLUDED.tls_insecure,updated_at=now()`,[input.tlsInsecure]);
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  return getFritzBoxPresenceSettings();
}

export async function listPresenceTargets(): Promise<PresenceTarget[]> {
  const result = await pool.query(`SELECT id,name,mac_address as "macAddress",absence_delay_seconds as "absenceDelaySeconds",created_at as "createdAt",updated_at as "updatedAt" FROM presence_targets ORDER BY name,id`);
  return result.rows;
}

export async function createPresenceTarget(name: string, macAddress: string, absenceDelaySeconds?: number): Promise<PresenceTarget> {
  const result = await pool.query(`INSERT INTO presence_targets(id,name,mac_address,absence_delay_seconds) VALUES($1,$2,$3,$4) RETURNING id,name,mac_address as "macAddress",absence_delay_seconds as "absenceDelaySeconds",created_at as "createdAt",updated_at as "updatedAt"`, [randomUUID(),name,macAddress,absenceDelaySeconds??null]);
  return result.rows[0];
}

export async function updatePresenceTarget(id: string, name: string, macAddress: string, absenceDelaySeconds?: number): Promise<PresenceTarget | undefined> {
  const result = await pool.query(`UPDATE presence_targets SET name=$2,mac_address=$3,absence_delay_seconds=$4,updated_at=now() WHERE id=$1 RETURNING id,name,mac_address as "macAddress",absence_delay_seconds as "absenceDelaySeconds",created_at as "createdAt",updated_at as "updatedAt"`, [id,name,macAddress,absenceDelaySeconds??null]);
  return result.rows[0];
}

export async function deletePresenceTarget(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM presence_targets WHERE id=$1", [id]);
  return result.rowCount === 1;
}


export async function getClimateModeSettings(): Promise<ClimateModeSettings> {
  const result = await pool.query<{ mode: "summer" | "winter"; winter_mode: "manual" | "auto"; last_applied_at: Date | string | null; last_result: unknown }>(
    "SELECT mode,winter_mode,last_applied_at,last_result FROM climate_mode_settings WHERE id='global'"
  );
  const row = result.rows[0];
  const rawResult = row?.last_result && typeof row.last_result === "object" ? row.last_result as Record<string, unknown> : {};
  const total = Number(rawResult.total);
  const succeeded = Number(rawResult.succeeded);
  const failed = Number(rawResult.failed);
  return {
    mode: row?.mode ?? "winter",
    winterMode: row?.winter_mode ?? "auto",
    ...(row?.last_applied_at ? { lastAppliedAt: row.last_applied_at instanceof Date ? row.last_applied_at.toISOString() : String(row.last_applied_at) } : {}),
    ...(Number.isFinite(total) && Number.isFinite(succeeded) && Number.isFinite(failed) ? { lastResult: { total, succeeded, failed } } : {})
  };
}

export async function updateClimateModeSettings(input: { mode: "summer" | "winter"; winterMode: "manual" | "auto"; lastAppliedAt?: string; lastResult?: { total: number; succeeded: number; failed: number } }): Promise<ClimateModeSettings> {
  await pool.query(`INSERT INTO climate_mode_settings(id,mode,winter_mode,last_applied_at,last_result,updated_at)
    VALUES('global',$1,$2,$3,$4::jsonb,now())
    ON CONFLICT(id) DO UPDATE SET mode=EXCLUDED.mode,winter_mode=EXCLUDED.winter_mode,last_applied_at=EXCLUDED.last_applied_at,last_result=EXCLUDED.last_result,updated_at=now()`,
    [input.mode,input.winterMode,input.lastAppliedAt??null,JSON.stringify(input.lastResult??{})]);
  return getClimateModeSettings();
}

export async function getPushoverSettings(): Promise<PushoverSettings> {
  const result = await pool.query<{ enabled: boolean; encrypted_user_key: string; encrypted_api_token: string; battery_threshold: number }>(
    "SELECT enabled,encrypted_user_key,encrypted_api_token,battery_threshold FROM notification_settings WHERE channel='pushover'"
  );
  const row = result.rows[0];
  const userSecret = row?.encrypted_user_key ?? "";
  const tokenSecret = row?.encrypted_api_token ?? "";
  return {
    enabled: row?.enabled ?? false,
    userKeyConfigured: Boolean(userSecret),
    apiTokenConfigured: Boolean(tokenSecret),
    encryptionStatus: (userSecret && !secretIsReadable(userSecret)) || (tokenSecret && !secretIsReadable(tokenSecret)) ? "invalid" : "ok",
    batteryThreshold: row?.battery_threshold ?? 20
  };
}

export async function getPushoverConnection(): Promise<{ enabled: boolean; userKey: string; apiToken: string; batteryThreshold: number }> {
  const result = await pool.query<{ enabled: boolean; encrypted_user_key: string; encrypted_api_token: string; battery_threshold: number }>(
    "SELECT enabled,encrypted_user_key,encrypted_api_token,battery_threshold FROM notification_settings WHERE channel='pushover'"
  );
  const row = result.rows[0];
  return {
    enabled: row?.enabled ?? false,
    userKey: decryptStoredSecret(row?.encrypted_user_key),
    apiToken: decryptStoredSecret(row?.encrypted_api_token),
    batteryThreshold: row?.battery_threshold ?? 20
  };
}

export async function updatePushoverSettings(input: { enabled: boolean; userKey?: string; apiToken?: string; batteryThreshold: number }): Promise<PushoverSettings> {
  const current = await pool.query<{ encrypted_user_key: string; encrypted_api_token: string }>(
    "SELECT encrypted_user_key,encrypted_api_token FROM notification_settings WHERE channel='pushover'"
  );
  const currentUser = current.rows[0]?.encrypted_user_key ?? "";
  const currentToken = current.rows[0]?.encrypted_api_token ?? "";
  if (input.userKey === undefined && currentUser && !secretIsReadable(currentUser)) throw new Error("ENCRYPTION_KEY_MISMATCH");
  if (input.apiToken === undefined && currentToken && !secretIsReadable(currentToken)) throw new Error("ENCRYPTION_KEY_MISMATCH");
  const encryptedUser = input.userKey === undefined ? currentUser : (input.userKey ? encryptSecret(input.userKey) : "");
  const encryptedToken = input.apiToken === undefined ? currentToken : (input.apiToken ? encryptSecret(input.apiToken) : "");
  await pool.query(`INSERT INTO notification_settings(channel,enabled,encrypted_user_key,encrypted_api_token,battery_threshold,updated_at)
    VALUES('pushover',$1,$2,$3,$4,now())
    ON CONFLICT(channel) DO UPDATE SET enabled=EXCLUDED.enabled,encrypted_user_key=EXCLUDED.encrypted_user_key,encrypted_api_token=EXCLUDED.encrypted_api_token,battery_threshold=EXCLUDED.battery_threshold,updated_at=now()`,
    [input.enabled,encryptedUser,encryptedToken,input.batteryThreshold]);
  return getPushoverSettings();
}

export async function getNotificationLastSent(key: string): Promise<string | undefined> {
  const result = await pool.query<{ last_sent_at: Date | string | null }>("SELECT last_sent_at FROM notification_state WHERE key=$1",[key]);
  const value = result.rows[0]?.last_sent_at;
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function setNotificationLastSent(key: string, at: string, details: Record<string, unknown> = {}): Promise<void> {
  await pool.query(`INSERT INTO notification_state(key,last_sent_at,details,updated_at) VALUES($1,$2,$3::jsonb,now())
    ON CONFLICT(key) DO UPDATE SET last_sent_at=EXCLUDED.last_sent_at,details=EXCLUDED.details,updated_at=now()`,[key,at,JSON.stringify(details)]);
}

export async function writeSystemLog(
  level: SystemLogLevel,
  source: string,
  code: string | undefined,
  message: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO system_logs(id,level,source,code,message,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
    [randomUUID(), level, source.slice(0, 80), code?.slice(0, 120) ?? null, message.slice(0, 1000), JSON.stringify(details)]
  );
  await pool.query("DELETE FROM system_logs WHERE created_at < now() - interval '30 days'");
  await pool.query("DELETE FROM system_logs WHERE id IN (SELECT id FROM system_logs ORDER BY created_at DESC, id DESC OFFSET 2000)");
}

export async function listSystemLogs(
  limit = 200,
  source?: string,
  level?: SystemLogLevel
): Promise<SystemLogEntry[]> {
  const values: unknown[] = [];
  const conditions: string[] = [];
  if (source) { values.push(source); conditions.push(`source=$${values.length}`); }
  if (level) { values.push(level); conditions.push(`level=$${values.length}`); }
  values.push(Math.max(1, Math.min(limit, 500)));
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query<SystemLogEntry>(
    `SELECT id,level,source,code,message,details,created_at as "createdAt" FROM system_logs ${where} ORDER BY created_at DESC LIMIT $${values.length}`,
    values
  );
  return result.rows;
}

export async function clearSystemLogs(): Promise<void> {
  await pool.query("DELETE FROM system_logs");
}
