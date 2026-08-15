import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { clientQuery, release, connect } = vi.hoisted(() => {
  const clientQuery = vi.fn();
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query: clientQuery, release }));
  return { clientQuery, release, connect };
});

vi.mock("./config.js", () => ({ config: { SALTA_ENCRYPTION_KEY: "test-backup-encryption-key-123456" } }));
vi.mock("./db.js", () => ({
  DATABASE_SCHEMA_VERSION: "0.5",
  pool: { connect }
}));

import { CONFIGURATION_BACKUP_FORMAT, createConfigurationBackup, importConfigurationBackup } from "./configuration-backup.js";

const encrypted = "v2.c2FsdA.aXY.dGFn.ZGF0YQ";

function rowsFor(sql: string): Record<string, unknown>[] {
  if (sql.includes("FROM rooms")) return [{ id: "11111111-1111-4111-8111-111111111111", name: "Wohnzimmer", icon: "sofa-outline", sort_order: 0 }];
  if (sql.includes("FROM devices")) return [
    { id: "shelly:test", source: "shelly", state: { power: 42 }, reachable: true, credential_password: encrypted },
    { id: "virtual:test", source: "virtual", state: { on: true }, reachable: true, credential_password: null }
  ];
  if (sql.includes("FROM adapter_settings")) return [{ adapter_id: "shelly", username: "admin", encrypted_password: encrypted }];
  if (sql.includes("FROM automations ")) return [{ id: "22222222-2222-4222-8222-222222222222", name: "Test" }];
  if (sql.includes("FROM automation_time_triggers")) return [{ automation_id: "22222222-2222-4222-8222-222222222222", time_of_day: "07:30" }];
  if (sql.includes("FROM automation_conditions")) return [{ automation_id: "22222222-2222-4222-8222-222222222222", position: 1, condition_device_id: "virtual:test", condition_state_key: "on", condition_value: true }];
  if (sql.includes("FROM automation_targets")) return [
    { automation_id: "22222222-2222-4222-8222-222222222222", position: 0, action_device_id: "virtual:test", action: "turnOn", value: null }
  ];
  if (sql.includes("FROM automation_system_actions")) return [{ automation_id: "22222222-2222-4222-8222-222222222222", position: 1, target: "climateMode", action: "climateWinter" }];
  if (sql.includes("FROM automation_actions")) return [{ automation_id: "22222222-2222-4222-8222-222222222222", position: 1, action_device_id: "virtual:test", action: "turnOn" }];
  if (sql.includes("FROM climate_mode_settings")) return [{ id: "global", mode: "winter", winter_mode: "auto" }];
  if (sql.includes("FROM notification_settings")) return [{ channel: "pushover", enabled: false, encrypted_user_key: "", encrypted_api_token: "", battery_threshold: 20 }];
  if (sql.includes("FROM notification_state")) return [{ key: "battery-low-weekly", last_sent_at: "2026-08-12T07:00:00.000Z", details: {} }];
  return [];
}

beforeEach(() => {
  clientQuery.mockReset();
  connect.mockClear();
  release.mockClear();
  clientQuery.mockImplementation(async (sql: string) => ({ rows: sql.startsWith("SELECT") ? rowsFor(sql) : [] }));
});

describe("configuration backup", () => {
  it("exports configuration with encrypted secrets and without live physical-device state", async () => {
    const backup = await createConfigurationBackup("0.8.41");

    expect(backup.format).toBe(CONFIGURATION_BACKUP_FORMAT);
    expect(backup.schemaVersion).toBe("0.5");
    expect(backup.saltaVersion).toBe("0.8.41");
    expect(backup.containsEncryptedSecrets).toBe(true);
    expect(backup.signature.length).toBeGreaterThan(20);
    expect(backup.data.devices[0]?.state).toEqual({});
    expect(backup.data.devices[0]?.reachable).toBe(false);
    expect(backup.data.devices[1]?.state).toEqual({ on: true });
    expect(JSON.stringify(backup)).not.toContain("plaintext-password");
  });

  it("restores a signed backup transactionally and preserves notification cooldown state", async () => {
    const backup = await createConfigurationBackup("0.8.41");
    clientQuery.mockClear();
    connect.mockClear();
    release.mockClear();
    await importConfigurationBackup(JSON.parse(JSON.stringify(backup)));

    expect(connect).toHaveBeenCalledTimes(1);
    expect(clientQuery).toHaveBeenCalledWith("BEGIN");
    expect(clientQuery).toHaveBeenCalledWith("DELETE FROM notification_state");
    expect(clientQuery).toHaveBeenCalledWith("DELETE FROM automation_system_actions");
    expect(clientQuery).toHaveBeenCalledWith("DELETE FROM automation_targets");
    expect(clientQuery).toHaveBeenCalledWith("DELETE FROM automation_actions");
    expect(clientQuery).toHaveBeenCalledWith("DELETE FROM automation_conditions");
    expect(clientQuery).toHaveBeenCalledWith("DELETE FROM automation_time_triggers");
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO notification_state SELECT * FROM jsonb_populate_recordset"))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO rooms SELECT * FROM jsonb_populate_recordset"))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO devices SELECT * FROM jsonb_populate_recordset"))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO automation_time_triggers SELECT * FROM jsonb_populate_recordset"))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO automation_conditions SELECT * FROM jsonb_populate_recordset"))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO automation_actions SELECT * FROM jsonb_populate_recordset"))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO automation_targets SELECT * FROM jsonb_populate_recordset"))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO automation_system_actions SELECT * FROM jsonb_populate_recordset"))).toBe(true);
    expect(clientQuery).toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalledTimes(1);
  });


  it("rolls back staged external recovery state when the database commit fails", async () => {
    const backup = await createConfigurationBackup("0.8.41");
    const rollback = vi.fn();
    const finalize = vi.fn();
    clientQuery.mockClear();
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === "COMMIT") throw new Error("commit failed");
      return { rows: [] };
    });

    await expect(importConfigurationBackup(backup, undefined, {
      beforeCommit: () => ({ rollback, finalize })
    })).rejects.toThrow("CONFIG_BACKUP_IMPORT_FAILED");

    expect(clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(finalize).not.toHaveBeenCalled();
  });

  it("rejects modified backup content before touching the database", async () => {
    const backup = await createConfigurationBackup("0.8.41");
    connect.mockClear();
    const modified = JSON.parse(JSON.stringify(backup));
    modified.data.rooms[0].name = "Manipuliert";

    await expect(importConfigurationBackup(modified)).rejects.toThrow("CONFIG_BACKUP_SIGNATURE_INVALID");
    expect(connect).not.toHaveBeenCalled();
  });
  it("accepts signed format-v1 backups created before additive automation schedule/action tables existed", async () => {
    const backup = await createConfigurationBackup("0.8.53");
    const data = { ...backup.data } as Record<string, unknown>;
    delete data.automation_time_triggers;
    delete data.automation_conditions;
    delete data.automation_actions;
    delete data.automation_targets;
    delete data.automation_system_actions;
    const { signature: _signature, ...base } = backup;
    void _signature;
    const unsigned = { ...base, data };
    const signature = createHmac("sha256", "test-backup-encryption-key-123456").update(JSON.stringify(unsigned), "utf8").digest("base64url");
    clientQuery.mockClear();
    connect.mockClear();
    release.mockClear();

    await importConfigurationBackup({ ...unsigned, signature });

    expect(clientQuery).toHaveBeenCalledWith("DELETE FROM automation_system_actions");
    expect(clientQuery).toHaveBeenCalledWith("DELETE FROM automation_targets");
    expect(clientQuery).toHaveBeenCalledWith("DELETE FROM automation_actions");
    expect(clientQuery).toHaveBeenCalledWith("DELETE FROM automation_conditions");
    expect(clientQuery).toHaveBeenCalledWith("DELETE FROM automation_time_triggers");
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO automation_time_triggers SELECT"))).toBe(false);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO automation_actions SELECT"))).toBe(false);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO automation_targets SELECT"))).toBe(false);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).startsWith("INSERT INTO automation_system_actions SELECT"))).toBe(false);
    expect(clientQuery).toHaveBeenCalledWith("COMMIT");
  });

});
