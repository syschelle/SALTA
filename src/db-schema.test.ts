import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const databaseSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const secretSource = readFileSync(new URL("./security/secrets.ts", import.meta.url), "utf8");

describe("clean database schema", () => {
  it("uses one canonical schema without incremental migration statements", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS salta_metadata");
    expect(databaseSource).toContain('DATABASE_SCHEMA_VERSION = "0.5"');
    expect(databaseSource).not.toMatch(/ALTER\s+TABLE/i);
    expect(databaseSource).not.toContain("upgradeCredentialEncryption");
  });

  it("adds daily automation schedules without altering the existing automations table", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS automation_time_triggers");
    expect(databaseSource).toContain("time_of_day text NOT NULL");
    expect(databaseSource).toContain("REFERENCES automations(id) ON DELETE CASCADE");
    expect(databaseSource).toContain("LEFT JOIN automation_time_triggers s ON s.automation_id=a.id");
  });

  it("does not restore the removed duplicate room-name column", () => {
    const devicesTable = databaseSource.match(/CREATE TABLE IF NOT EXISTS devices \(([\s\S]*?)\n    \);/i)?.[1] ?? "";
    expect(devicesTable).toContain("room_id uuid");
    expect(devicesTable).not.toMatch(/^\s*room\s+text/im);
    expect(databaseSource).not.toContain("Create room automatically from its name");
    expect(databaseSource).not.toContain("SELECT id FROM rooms WHERE name=$1");
  });


  it("stores OpenCCU credentials and adapter metadata in additive tables", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS openccu_settings");
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS device_adapter_data");
    expect(databaseSource).toContain("encrypted_password text NOT NULL DEFAULT ''");
    expect(databaseSource).toContain("LEFT JOIN device_adapter_data ad ON ad.device_id=d.id");
  });

  it("stores device visibility separately without altering the devices table", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS device_preferences");
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS device_favorites");
    expect(databaseSource).toContain("favorite boolean NOT NULL DEFAULT false");
    expect(databaseSource).toContain("hidden boolean NOT NULL DEFAULT false");
    expect(databaseSource).toContain('COALESCE(p.hidden,false) as hidden');
    expect(databaseSource).toContain("LEFT JOIN device_preferences p ON p.device_id=d.id");
    expect(databaseSource).toContain("LEFT JOIN device_favorites f ON f.device_id=d.id");
    expect(databaseSource).toContain('COALESCE(f.favorite,false) as favorite');
  });


  it("stores automations and room preferences as additive canonical tables", () => {
    const automationsTable = databaseSource.match(/CREATE TABLE IF NOT EXISTS automations \(([\s\S]*?)\n    \);/i)?.[1] ?? "";
    expect(automationsTable).toContain("trigger_device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE");
    expect(automationsTable).toContain("condition_device_id text REFERENCES devices(id) ON DELETE CASCADE");
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS automation_conditions");
    expect(databaseSource).toContain("condition_device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE");
    expect(automationsTable).toContain("action_device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE");
    expect(automationsTable).not.toContain("room_id");
    expect(automationsTable).toContain("CHECK(action IN ('turnOn','turnOff','toggle'))");

    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS automation_preferences");
    expect(databaseSource).toContain("automation_id uuid PRIMARY KEY REFERENCES automations(id) ON DELETE CASCADE");
    expect(databaseSource).toContain("room_id uuid REFERENCES rooms(id) ON DELETE SET NULL");
    expect(databaseSource).toContain("LEFT JOIN automation_preferences p ON p.automation_id=a.id");
    expect(databaseSource).toContain("INSERT INTO automation_preferences(automation_id,room_id)");
    expect(databaseSource).toContain("ON CONFLICT(automation_id) DO UPDATE SET room_id=EXCLUDED.room_id,updated_at=now()");
    expect(databaseSource).toContain('p.room_id as "roomId"');
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS automation_triggers");
    expect(databaseSource).toContain("automation_id uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE");
    expect(databaseSource).toContain("position smallint NOT NULL CHECK(position BETWEEN 1 AND 7)");
    expect(databaseSource).toContain("trigger_device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE");
    expect(databaseSource).toContain("PRIMARY KEY(automation_id,position)");
    expect(databaseSource).toContain('as "additionalConditions"');
    expect(databaseSource).toContain("DELETE FROM automation_conditions WHERE automation_id=$1");
    expect(databaseSource).toContain('as "additionalTriggers"');
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS automation_actions");
    expect(databaseSource).toContain("action_device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE");
    expect(databaseSource).toContain("UNIQUE(automation_id,action_device_id)");
    expect(databaseSource).toContain("CREATE INDEX IF NOT EXISTS automation_actions_device_idx");
    expect(databaseSource).toContain('as "additionalActions"');
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS automation_targets");
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS automation_system_actions");
    expect(databaseSource).toContain("CHECK(action IN ('climateSummer','climateWinter'))");
    expect(databaseSource).toContain("INSERT INTO automation_system_actions(automation_id,position,target,action)");
    expect(databaseSource).toContain("DELETE FROM automation_system_actions WHERE automation_id=$1");
    expect(databaseSource).toContain("'system:climate-mode','system','climate-mode'");
    expect(databaseSource).toContain("jsonb_build_array('setClimateMode')");
    expect(databaseSource).toContain("'winterActive',(mode='winter')");
    expect(databaseSource).not.toContain("ARRAY['setClimateMode']::text[]");
    expect(databaseSource).toContain("position smallint NOT NULL CHECK(position BETWEEN 0 AND 7)");
    expect(databaseSource).toContain("setTargetTemperature");
    expect(databaseSource).toContain("value double precision");
    expect(databaseSource).toContain("CREATE INDEX IF NOT EXISTS automation_targets_device_idx");
    expect(databaseSource).toContain('as "targetActions"');
    expect(databaseSource).toContain("INSERT INTO automation_targets(automation_id,position,action_device_id,action,value)");
    expect(databaseSource).toContain("DELETE FROM automation_targets WHERE automation_id=$1");
  });

  it("stores FRITZ!Box presence settings and monitored MAC addresses additively", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS fritzbox_presence_settings");
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS presence_targets");
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS presence_target_profiles");
    expect(databaseSource).toContain("person_name text NOT NULL");
    expect(databaseSource).toContain("LEFT JOIN presence_target_profiles p ON p.target_id=t.id");
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS fritzbox_presence_transport_settings");
    expect(databaseSource).toContain("tls_insecure boolean NOT NULL DEFAULT false");
    expect(databaseSource).toContain("poll_interval_seconds integer NOT NULL DEFAULT 30");
    expect(databaseSource).toContain("absence_delay_seconds integer NOT NULL DEFAULT 300");
    expect(databaseSource).toContain("mac_address text NOT NULL UNIQUE");
    expect(databaseSource).toContain("encrypted_password text NOT NULL DEFAULT ''");
  });

  it("stores HomeKit publication preferences in an additive settings table", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS device_homekit_settings");
    expect(databaseSource).toContain("enabled boolean NOT NULL DEFAULT true");
    expect(databaseSource).toContain("name_override text");
    expect(databaseSource).toContain("use_salta_room boolean NOT NULL DEFAULT true");
    expect(databaseSource).toContain("room_id uuid REFERENCES rooms(id) ON DELETE SET NULL");
    expect(databaseSource).toContain("LEFT JOIN device_homekit_settings hk ON hk.device_id=d.id");
    expect(databaseSource).toContain("LEFT JOIN rooms hkr ON hkr.id=hk.room_id");
  });

  it("stores climate mode and notification throttling additively", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS climate_mode_settings");
    expect(databaseSource).toContain("CHECK(mode IN ('summer','winter'))");
    expect(databaseSource).toContain("CHECK(winter_mode IN ('manual','auto'))");
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS notification_settings");
    expect(databaseSource).toContain("encrypted_user_key text NOT NULL DEFAULT ''");
    expect(databaseSource).toContain("encrypted_api_token text NOT NULL DEFAULT ''");
    expect(databaseSource).toContain("battery_threshold integer NOT NULL DEFAULT 20");
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS notification_state");
  });

  it("keeps persistent command history bounded without a schema migration", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS commands");
    expect(databaseSource).toContain("created_at < now() - interval '90 days'");
    expect(databaseSource).toContain("ORDER BY created_at DESC, id DESC OFFSET 10000");
    expect(databaseSource).toContain("export async function pruneCommandHistory(): Promise<void>");
  });

  it("stores a bounded persistent system log", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS system_logs");
    expect(databaseSource).toContain("CHECK(level IN ('info','warning','error'))");
    expect(databaseSource).toContain("created_at < now() - interval '30 days'");
    expect(databaseSource).toContain("ORDER BY created_at DESC, id DESC OFFSET 100");
    expect(databaseSource).toContain("limit = 100");
    expect(databaseSource).toContain("Math.min(limit, 100)");
    expect(databaseSource).not.toContain("OFFSET 2000");
  });

  it("accepts only the current v2 encrypted-secret format", () => {
    expect(secretSource).toContain('parts[0] === "v2"');
    expect(secretSource).not.toContain('parts[0] === "v1"');
    expect(secretSource).not.toContain("legacyKey");
  });
});
