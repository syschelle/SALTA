import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scryptSync
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { config } from "./config.js";
import {
  createConfigurationBackup,
  importConfigurationBackup,
  type ConfigurationImportExternalTransaction,
  type ConfigurationImportResult
} from "./configuration-backup.js";
import { DATABASE_SCHEMA_VERSION } from "./db.js";
import {
  currentRestorableRuntimeSettings,
  parseRestorableRuntimeSettings,
  runtimeSettingsPath,
  writePersistedRuntimeSettings,
  type RestorableRuntimeSettings
} from "./runtime-settings.js";

export const DISASTER_RECOVERY_BACKUP_FORMAT = "salta-disaster-recovery-backup";
export const DISASTER_RECOVERY_BACKUP_FORMAT_VERSION = 1;
const DISASTER_RECOVERY_PAYLOAD_VERSION = 1;
const MAX_HOMEKIT_FILES = 256;
const MAX_HOMEKIT_FILE_BYTES = 512 * 1024;
const MAX_HOMEKIT_TOTAL_BYTES = 4 * 1024 * 1024;

const passwordSchema = z.string().min(12).max(256);

const homeKitFileSchema = z.object({
  name: z.string().min(1).max(240),
  content: z.string().max(Math.ceil(MAX_HOMEKIT_FILE_BYTES * 1.4) + 16)
}).strict();

const payloadSchema = z.object({
  payloadVersion: z.literal(DISASTER_RECOVERY_PAYLOAD_VERSION),
  schemaVersion: z.string().min(1).max(32),
  createdAt: z.string().datetime(),
  saltaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  runtimeSettings: z.record(z.string()),
  deploymentHints: z.object({
    webPort: z.number().int().min(1).max(65535),
    homeKitPort: z.number().int().min(1).max(65535),
    timezone: z.string().max(120)
  }).strict(),
  configuration: z.unknown(),
  homeKit: z.object({
    files: z.array(homeKitFileSchema).max(MAX_HOMEKIT_FILES)
  }).strict()
}).strict();

const envelopeSchema = z.object({
  format: z.literal(DISASTER_RECOVERY_BACKUP_FORMAT),
  formatVersion: z.literal(DISASTER_RECOVERY_BACKUP_FORMAT_VERSION),
  saltaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  createdAt: z.string().datetime(),
  summary: z.object({
    rooms: z.number().int().min(0),
    devices: z.number().int().min(0),
    automations: z.number().int().min(0),
    presenceTargets: z.number().int().min(0),
    homeKitFiles: z.number().int().min(0).max(MAX_HOMEKIT_FILES)
  }).strict(),
  encryption: z.object({
    algorithm: z.literal("aes-256-gcm"),
    kdf: z.literal("scrypt"),
    salt: z.string().min(16).max(128),
    iv: z.string().min(12).max(128),
    tag: z.string().min(16).max(128)
  }).strict(),
  ciphertext: z.string().min(1).max(12 * 1024 * 1024)
}).strict();

export type DisasterRecoveryBackup = z.infer<typeof envelopeSchema>;

type RecoveryPayload = z.infer<typeof payloadSchema>;
type HomeKitFile = z.infer<typeof homeKitFileSchema>;

function assertBackupPassword(password: string): string {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) throw new Error("DISASTER_RECOVERY_PASSWORD_INVALID");
  return parsed.data;
}

function keyFromPassword(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function aadFor(envelope: Pick<DisasterRecoveryBackup, "format" | "formatVersion" | "saltaVersion" | "createdAt" | "summary">): Buffer {
  return Buffer.from(JSON.stringify(envelope), "utf8");
}

function plainStorageFileName(name: string): boolean {
  return Boolean(name) && name.length <= 240 && !name.startsWith(".") && !name.includes("/") && !name.includes("\\");
}

function readHomeKitStorage(path = config.HOMEKIT_STORAGE_PATH): HomeKitFile[] {
  if (!existsSync(path)) return [];
  const result: HomeKitFile[] = [];
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (result.length >= MAX_HOMEKIT_FILES) throw new Error("DISASTER_RECOVERY_HOMEKIT_TOO_LARGE");
    if (!entry.isFile() || !plainStorageFileName(entry.name)) continue;
    const file = join(path, entry.name);
    const size = statSync(file).size;
    if (size > MAX_HOMEKIT_FILE_BYTES) throw new Error("DISASTER_RECOVERY_HOMEKIT_TOO_LARGE");
    total += size;
    if (total > MAX_HOMEKIT_TOTAL_BYTES) throw new Error("DISASTER_RECOVERY_HOMEKIT_TOO_LARGE");
    result.push({ name: entry.name, content: readFileSync(file).toString("base64") });
  }
  return result.sort((left, right) => left.name.localeCompare(right.name));
}

function validateHomeKitFiles(files: HomeKitFile[]): void {
  let total = 0;
  const names = new Set<string>();
  for (const file of files) {
    if (!plainStorageFileName(file.name) || names.has(file.name)) throw new Error("DISASTER_RECOVERY_INVALID");
    names.add(file.name);
    const bytes = Buffer.from(file.content, "base64");
    if (bytes.length > MAX_HOMEKIT_FILE_BYTES) throw new Error("DISASTER_RECOVERY_HOMEKIT_TOO_LARGE");
    total += bytes.length;
    if (total > MAX_HOMEKIT_TOTAL_BYTES) throw new Error("DISASTER_RECOVERY_HOMEKIT_TOO_LARGE");
  }
}

function stageHomeKitFiles(files: HomeKitFile[], target: string): string {
  validateHomeKitFiles(files);
  const parent = dirname(target);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const stage = `${target}.restore-${randomUUID()}`;
  mkdirSync(stage, { recursive: false, mode: 0o700 });
  try {
    for (const file of files) {
      writeFileSync(join(stage, file.name), Buffer.from(file.content, "base64"), { mode: 0o600 });
    }
    return stage;
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

function restoreRuntimeSettingsRaw(path: string, previous: Buffer | null): void {
  if (previous === null) {
    try { unlinkSync(path); } catch { /* File may not exist. */ }
    return;
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, previous, { mode: 0o600 });
}

function installRecoveryFilesystemState(payload: RecoveryPayload): ConfigurationImportExternalTransaction {
  const runtimeSettings = parseRestorableRuntimeSettings(payload.runtimeSettings);
  const homeKitTarget = config.HOMEKIT_STORAGE_PATH;
  const runtimeTarget = runtimeSettingsPath();
  const stagedHomeKit = stageHomeKitFiles(payload.homeKit.files, homeKitTarget);
  const previousRuntime = existsSync(runtimeTarget) ? readFileSync(runtimeTarget) : null;
  const previousHomeKit = existsSync(homeKitTarget) ? `${homeKitTarget}.previous-${randomUUID()}` : null;
  let homeKitInstalled = false;
  let runtimeInstalled = false;

  try {
    if (previousHomeKit) renameSync(homeKitTarget, previousHomeKit);
    renameSync(stagedHomeKit, homeKitTarget);
    homeKitInstalled = true;
    writePersistedRuntimeSettings(runtimeSettings, runtimeTarget);
    runtimeInstalled = true;
  } catch (error) {
    if (runtimeInstalled) restoreRuntimeSettingsRaw(runtimeTarget, previousRuntime);
    if (homeKitInstalled) rmSync(homeKitTarget, { recursive: true, force: true });
    if (previousHomeKit && existsSync(previousHomeKit)) renameSync(previousHomeKit, homeKitTarget);
    if (existsSync(stagedHomeKit)) rmSync(stagedHomeKit, { recursive: true, force: true });
    throw error;
  }

  return {
    rollback() {
      restoreRuntimeSettingsRaw(runtimeTarget, previousRuntime);
      rmSync(homeKitTarget, { recursive: true, force: true });
      if (previousHomeKit && existsSync(previousHomeKit)) renameSync(previousHomeKit, homeKitTarget);
    },
    finalize() {
      if (previousHomeKit) rmSync(previousHomeKit, { recursive: true, force: true });
    }
  };
}

function encryptPayload(payload: RecoveryPayload, password: string, summary: DisasterRecoveryBackup["summary"]): DisasterRecoveryBackup {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const header = {
    format: DISASTER_RECOVERY_BACKUP_FORMAT,
    formatVersion: DISASTER_RECOVERY_BACKUP_FORMAT_VERSION,
    saltaVersion: payload.saltaVersion,
    createdAt: payload.createdAt,
    summary
  } as const;
  const cipher = createCipheriv("aes-256-gcm", keyFromPassword(password, salt), iv);
  cipher.setAAD(aadFor(header));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return {
    ...header,
    encryption: {
      algorithm: "aes-256-gcm",
      kdf: "scrypt",
      salt: salt.toString("base64url"),
      iv: iv.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url")
    },
    ciphertext: ciphertext.toString("base64")
  };
}

function decryptPayload(input: unknown, password: string): { envelope: DisasterRecoveryBackup; payload: RecoveryPayload } {
  const parsedEnvelope = envelopeSchema.safeParse(input);
  if (!parsedEnvelope.success) throw new Error("DISASTER_RECOVERY_INVALID");
  const envelope = parsedEnvelope.data;
  try {
    const salt = Buffer.from(envelope.encryption.salt, "base64url");
    const iv = Buffer.from(envelope.encryption.iv, "base64url");
    const tag = Buffer.from(envelope.encryption.tag, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", keyFromPassword(password, salt), iv);
    decipher.setAAD(aadFor(envelope));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8");
    const parsedPayload = payloadSchema.safeParse(JSON.parse(plaintext));
    if (!parsedPayload.success) throw new Error("DISASTER_RECOVERY_INVALID");
    const payload = parsedPayload.data;
    if (payload.schemaVersion !== DATABASE_SCHEMA_VERSION) throw new Error("DISASTER_RECOVERY_SCHEMA_MISMATCH");
    if (payload.saltaVersion !== envelope.saltaVersion || payload.createdAt !== envelope.createdAt) throw new Error("DISASTER_RECOVERY_INVALID");
    validateHomeKitFiles(payload.homeKit.files);
    parseRestorableRuntimeSettings(payload.runtimeSettings);
    return { envelope, payload };
  } catch (error) {
    if (error instanceof Error && ["DISASTER_RECOVERY_SCHEMA_MISMATCH", "DISASTER_RECOVERY_INVALID", "DISASTER_RECOVERY_HOMEKIT_TOO_LARGE"].includes(error.message)) throw error;
    throw new Error("DISASTER_RECOVERY_DECRYPT_FAILED");
  }
}

export async function createDisasterRecoveryBackup(saltaVersion: string, passwordInput: string): Promise<DisasterRecoveryBackup> {
  const password = assertBackupPassword(passwordInput);
  const createdAt = new Date().toISOString();
  const runtimeSettings = currentRestorableRuntimeSettings(config as unknown as Record<string, unknown>);
  const configuration = await createConfigurationBackup(saltaVersion, runtimeSettings.SALTA_ENCRYPTION_KEY);
  const homeKitFiles = readHomeKitStorage();
  const payload: RecoveryPayload = {
    payloadVersion: DISASTER_RECOVERY_PAYLOAD_VERSION,
    schemaVersion: DATABASE_SCHEMA_VERSION,
    createdAt,
    saltaVersion,
    runtimeSettings,
    deploymentHints: {
      webPort: config.WEB_PORT,
      homeKitPort: config.HOMEKIT_PORT,
      timezone: process.env.TZ?.trim() || ""
    },
    configuration,
    homeKit: { files: homeKitFiles }
  };
  const summary = {
    rooms: configuration.data.rooms.length,
    devices: configuration.data.devices.length,
    automations: configuration.data.automations.length,
    presenceTargets: configuration.data.presence_targets.length,
    homeKitFiles: homeKitFiles.length
  };
  return encryptPayload(payload, password, summary);
}

export interface DisasterRecoveryImportResult extends ConfigurationImportResult {
  homeKitFiles: number;
  runtimeSettingsRestored: true;
  deploymentWarnings: string[];
}

export async function importDisasterRecoveryBackup(input: unknown, passwordInput: string): Promise<DisasterRecoveryImportResult> {
  const password = assertBackupPassword(passwordInput);
  const { payload } = decryptPayload(input, password);
  const runtimeSettings = parseRestorableRuntimeSettings(payload.runtimeSettings) as RestorableRuntimeSettings;
  const deploymentWarnings: string[] = [];
  if (payload.deploymentHints.webPort !== config.WEB_PORT) deploymentWarnings.push(`WEB_PORT:${payload.deploymentHints.webPort}->${config.WEB_PORT}`);
  if (payload.deploymentHints.homeKitPort !== config.HOMEKIT_PORT) deploymentWarnings.push(`HOMEKIT_PORT:${payload.deploymentHints.homeKitPort}->${config.HOMEKIT_PORT}`);
  const currentTimezone = process.env.TZ?.trim() || "";
  if (payload.deploymentHints.timezone && payload.deploymentHints.timezone !== currentTimezone) deploymentWarnings.push(`TZ:${payload.deploymentHints.timezone}->${currentTimezone || "default"}`);

  const result = await importConfigurationBackup(payload.configuration, runtimeSettings.SALTA_ENCRYPTION_KEY, {
    beforeCommit: () => installRecoveryFilesystemState(payload)
  });
  return {
    ...result,
    homeKitFiles: payload.homeKit.files.length,
    runtimeSettingsRestored: true,
    deploymentWarnings
  };
}
