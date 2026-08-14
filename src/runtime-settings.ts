import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const RUNTIME_SETTINGS_FORMAT = "salta-runtime-recovery-settings";
export const RUNTIME_SETTINGS_FORMAT_VERSION = 1;

export const RESTORABLE_RUNTIME_KEYS = [
  "LOG_LEVEL",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "SESSION_TTL_MINUTES",
  "TRUSTED_PROXIES",
  "LOCAL_NETWORKS",
  "RATE_LIMIT_PER_MINUTE",
  "RATE_LIMIT_MUTATIONS_PER_MINUTE",
  "RATE_LIMIT_GLOBAL_PER_MINUTE",
  "LOGIN_MAX_ATTEMPTS",
  "LOGIN_WINDOW_MINUTES",
  "LOGIN_BLOCK_MINUTES",
  "HOMEKIT_ENABLED",
  "HOMEKIT_NAME",
  "HOMEKIT_PIN",
  "HOMEKIT_USERNAME",
  "SALTA_ENCRYPTION_KEY"
] as const;

export type RestorableRuntimeKey = typeof RESTORABLE_RUNTIME_KEYS[number];
export type RestorableRuntimeSettings = Record<RestorableRuntimeKey, string>;

const settingsSchema = z.object({
  LOG_LEVEL: z.string().max(32),
  ADMIN_USERNAME: z.string().max(64),
  ADMIN_PASSWORD: z.string().max(4096),
  SESSION_TTL_MINUTES: z.string().max(16),
  TRUSTED_PROXIES: z.string().max(4096),
  LOCAL_NETWORKS: z.string().max(4096),
  RATE_LIMIT_PER_MINUTE: z.string().max(16),
  RATE_LIMIT_MUTATIONS_PER_MINUTE: z.string().max(16),
  RATE_LIMIT_GLOBAL_PER_MINUTE: z.string().max(16),
  LOGIN_MAX_ATTEMPTS: z.string().max(16),
  LOGIN_WINDOW_MINUTES: z.string().max(16),
  LOGIN_BLOCK_MINUTES: z.string().max(16),
  HOMEKIT_ENABLED: z.enum(["true", "false"]),
  HOMEKIT_NAME: z.string().max(255),
  HOMEKIT_PIN: z.string().max(32),
  HOMEKIT_USERNAME: z.string().max(64),
  SALTA_ENCRYPTION_KEY: z.string().max(4096)
}).strict();

const fileSchema = z.object({
  format: z.literal(RUNTIME_SETTINGS_FORMAT),
  formatVersion: z.literal(RUNTIME_SETTINGS_FORMAT_VERSION),
  updatedAt: z.string().datetime(),
  settings: settingsSchema
}).strict();

export function runtimeSettingsPath(): string {
  return process.env.SALTA_RUNTIME_SETTINGS_PATH?.trim() || "/var/lib/salta/runtime/settings.json";
}

export function loadPersistedRuntimeSettings(path = runtimeSettingsPath()): Partial<Record<string, string>> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  const parsed = fileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("SALTA_RUNTIME_SETTINGS_INVALID");
  return parsed.data.settings;
}

export function writePersistedRuntimeSettings(settings: RestorableRuntimeSettings, path = runtimeSettingsPath()): void {
  const parsed = settingsSchema.parse(settings);
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  const payload = `${JSON.stringify({
    format: RUNTIME_SETTINGS_FORMAT,
    formatVersion: RUNTIME_SETTINGS_FORMAT_VERSION,
    updatedAt: new Date().toISOString(),
    settings: parsed
  }, null, 2)}\n`;
  try {
    writeFileSync(temporary, payload, { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, path);
  } catch (error) {
    try { unlinkSync(temporary); } catch { /* Nothing to clean up. */ }
    throw error;
  }
}

export function currentRestorableRuntimeSettings(config: Record<string, unknown>): RestorableRuntimeSettings {
  const settings = Object.fromEntries(RESTORABLE_RUNTIME_KEYS.map(key => {
    const value = config[key];
    return [key, typeof value === "boolean" ? String(value) : String(value ?? "")];
  }));
  return settingsSchema.parse(settings);
}

export function parseRestorableRuntimeSettings(input: unknown): RestorableRuntimeSettings {
  return settingsSchema.parse(input);
}
