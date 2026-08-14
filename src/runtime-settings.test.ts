import { readFileSync, rmSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadPersistedRuntimeSettings, writePersistedRuntimeSettings, type RestorableRuntimeSettings } from "./runtime-settings.js";

const path = `/tmp/salta-runtime-settings-${process.pid}.json`;
const settings: RestorableRuntimeSettings = {
  LOG_LEVEL: "info", ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "admin-password-123456", SESSION_TTL_MINUTES: "720",
  TRUSTED_PROXIES: "", LOCAL_NETWORKS: "192.168.0.0/16", RATE_LIMIT_PER_MINUTE: "300", RATE_LIMIT_MUTATIONS_PER_MINUTE: "60",
  RATE_LIMIT_GLOBAL_PER_MINUTE: "3000", LOGIN_MAX_ATTEMPTS: "5", LOGIN_WINDOW_MINUTES: "15", LOGIN_BLOCK_MINUTES: "15",
  HOMEKIT_ENABLED: "true", HOMEKIT_NAME: "SALTA Bridge", HOMEKIT_PIN: "031-45-154", HOMEKIT_USERNAME: "02:42:53:41:4C:54",
  SALTA_ENCRYPTION_KEY: "runtime-encryption-key-123456"
};

describe("runtime recovery settings", () => {
  it("writes and reloads only the explicit disaster-recovery runtime contract", () => {
    rmSync(path, { force: true });
    writePersistedRuntimeSettings(settings, path);
    expect(loadPersistedRuntimeSettings(path)).toEqual(settings);
    expect(JSON.parse(readFileSync(path, "utf8")).format).toBe("salta-runtime-recovery-settings");
    rmSync(path, { force: true });
  });
});
