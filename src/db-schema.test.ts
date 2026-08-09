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
    expect(databaseSource).toContain("hidden boolean NOT NULL DEFAULT false");
    expect(databaseSource).toContain('COALESCE(p.hidden,false) as hidden');
    expect(databaseSource).toContain("LEFT JOIN device_preferences p ON p.device_id=d.id");
  });


  it("stores automations and room preferences as additive canonical tables", () => {
    const automationsTable = databaseSource.match(/CREATE TABLE IF NOT EXISTS automations \(([\s\S]*?)\n    \);/i)?.[1] ?? "";
    expect(automationsTable).toContain("trigger_device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE");
    expect(automationsTable).toContain("condition_device_id text REFERENCES devices(id) ON DELETE CASCADE");
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
    expect(databaseSource).toContain('as "additionalTriggers"');
  });

  it("stores FRITZ!Box presence settings and monitored MAC addresses additively", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS fritzbox_presence_settings");
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS presence_targets");
    expect(databaseSource).toContain("poll_interval_seconds integer NOT NULL DEFAULT 30");
    expect(databaseSource).toContain("absence_delay_seconds integer NOT NULL DEFAULT 300");
    expect(databaseSource).toContain("mac_address text NOT NULL UNIQUE");
    expect(databaseSource).toContain("encrypted_password text NOT NULL DEFAULT ''");
  });

  it("stores a bounded persistent system log", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS system_logs");
    expect(databaseSource).toContain("CHECK(level IN ('info','warning','error'))");
    expect(databaseSource).toContain("created_at < now() - interval '30 days'");
    expect(databaseSource).toContain("ORDER BY created_at DESC, id DESC OFFSET 2000");
  });

  it("accepts only the current v2 encrypted-secret format", () => {
    expect(secretSource).toContain('parts[0] === "v2"');
    expect(secretSource).not.toContain('parts[0] === "v1"');
    expect(secretSource).not.toContain("legacyKey");
  });
});
