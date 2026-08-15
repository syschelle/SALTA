import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const testRoot = `/tmp/salta-disaster-recovery-${process.pid}`;
const homeKitPath = `${testRoot}/homekit`;
const runtimePath = `${testRoot}/runtime/settings.json`;
process.env.SALTA_RUNTIME_SETTINGS_PATH = runtimePath;
process.env.TZ = "Europe/Berlin";

vi.mock("./config.js", () => ({
  config: {
    WEB_PORT: 8099,
    LOG_LEVEL: "info",
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "restored-admin-password-123",
    SESSION_TTL_MINUTES: 720,
    TRUSTED_PROXIES: "192.168.178.10",
    LOCAL_NETWORKS: "192.168.178.0/24",
    RATE_LIMIT_PER_MINUTE: 300,
    RATE_LIMIT_MUTATIONS_PER_MINUTE: 60,
    RATE_LIMIT_GLOBAL_PER_MINUTE: 3000,
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_WINDOW_MINUTES: 15,
    LOGIN_BLOCK_MINUTES: 15,
    HOMEKIT_ENABLED: true,
    HOMEKIT_NAME: "SALTA Bridge",
    HOMEKIT_PIN: "031-45-154",
    HOMEKIT_PORT: 51826,
    HOMEKIT_USERNAME: "02:42:53:41:4C:54",
    HOMEKIT_STORAGE_PATH: `/tmp/salta-disaster-recovery-${process.pid}/homekit`,
    SALTA_ENCRYPTION_KEY: "restored-encryption-key-1234567890"
  }
}));

vi.mock("./db.js", () => ({ DATABASE_SCHEMA_VERSION: "0.5" }));

vi.mock("./configuration-backup.js", () => ({
  createConfigurationBackup: vi.fn(async (version: string, signingKey: string) => ({
    format: "salta-configuration-backup",
    formatVersion: 1,
    schemaVersion: "0.5",
    saltaVersion: version,
    createdAt: "2026-08-14T07:00:00.000Z",
    containsEncryptedSecrets: true,
    data: {
      rooms: [{ id: "room-1" }],
      devices: [{ id: "device-1" }],
      device_preferences: [], device_homekit_settings: [], adapter_settings: [], openccu_settings: [],
      fritzbox_presence_settings: [], fritzbox_presence_transport_settings: [], presence_targets: [{ id: "presence-1" }],
      device_adapter_data: [], automations: [{ id: "automation-1" }], automation_preferences: [], automation_triggers: [], automation_actions: [], automation_targets: [],
      climate_mode_settings: [], notification_settings: [], notification_state: []
    },
    signature: `signed-with:${signingKey}`
  })),
  importConfigurationBackup: vi.fn(async (_backup: unknown, signingKey: string, options: { beforeCommit?: () => Promise<{ rollback(): void; finalize?(): void } | void> }) => {
    expect(signingKey).toBe("restored-encryption-key-1234567890");
    const external = await options.beforeCommit?.();
    await external?.finalize?.();
    return { importedAt: "2026-08-14T07:05:00.000Z", sourceVersion: "0.8.41", rooms: 1, devices: 1, automations: 1, presenceTargets: 1, containsEncryptedSecrets: true };
  })
}));

import { createConfigurationBackup, importConfigurationBackup } from "./configuration-backup.js";
import { createDisasterRecoveryBackup, DISASTER_RECOVERY_BACKUP_FORMAT, importDisasterRecoveryBackup } from "./disaster-recovery-backup.js";

beforeEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(homeKitPath, { recursive: true });
  vi.mocked(createConfigurationBackup).mockClear();
  vi.mocked(importConfigurationBackup).mockClear();
});

describe("disaster recovery backup", () => {
  it("encrypts runtime secrets and HomeKit pairing files into one password protected backup", async () => {
    writeFileSync(`${homeKitPath}/AccessoryInfo.024253414C54.json`, '{"paired":true}');
    const backup = await createDisasterRecoveryBackup("0.8.41", "correct horse battery staple");

    expect(backup.format).toBe(DISASTER_RECOVERY_BACKUP_FORMAT);
    expect(backup.summary).toMatchObject({ rooms: 1, devices: 1, automations: 1, presenceTargets: 1, homeKitFiles: 1 });
    const serialized = JSON.stringify(backup);
    expect(serialized).not.toContain("restored-admin-password-123");
    expect(serialized).not.toContain("restored-encryption-key-1234567890");
    expect(serialized).not.toContain("paired");
    expect(createConfigurationBackup).toHaveBeenCalledWith("0.8.41", "restored-encryption-key-1234567890");
  });

  it("restores the original SALTA runtime identity and HomeKit pairing state", async () => {
    writeFileSync(`${homeKitPath}/AccessoryInfo.024253414C54.json`, '{"paired":true}');
    const backup = await createDisasterRecoveryBackup("0.8.41", "correct horse battery staple");
    rmSync(homeKitPath, { recursive: true, force: true });
    mkdirSync(homeKitPath, { recursive: true });
    writeFileSync(`${homeKitPath}/stale.json`, '{"stale":true}');

    const result = await importDisasterRecoveryBackup(backup, "correct horse battery staple");

    expect(result.homeKitFiles).toBe(1);
    expect(result.runtimeSettingsRestored).toBe(true);
    expect(readFileSync(`${homeKitPath}/AccessoryInfo.024253414C54.json`, "utf8")).toContain('"paired":true');
    expect(() => readFileSync(`${homeKitPath}/stale.json`, "utf8")).toThrow();
    const runtime = JSON.parse(readFileSync(runtimePath, "utf8"));
    expect(runtime.settings.SALTA_ENCRYPTION_KEY).toBe("restored-encryption-key-1234567890");
    expect(runtime.settings.ADMIN_PASSWORD).toBe("restored-admin-password-123");
    expect(runtime.settings.HOMEKIT_USERNAME).toBe("02:42:53:41:4C:54");
    expect(importConfigurationBackup).toHaveBeenCalledTimes(1);
  });

  it("rejects a wrong password before touching persistent configuration", async () => {
    const backup = await createDisasterRecoveryBackup("0.8.41", "correct horse battery staple");
    vi.mocked(importConfigurationBackup).mockClear();

    await expect(importDisasterRecoveryBackup(backup, "this is the wrong password")).rejects.toThrow("DISASTER_RECOVERY_DECRYPT_FAILED");
    expect(importConfigurationBackup).not.toHaveBeenCalled();
  });
});
