import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { config } from "./config.js";
import { DATABASE_SCHEMA_VERSION, pool } from "./db.js";

export const CONFIGURATION_BACKUP_FORMAT = "salta-configuration-backup";
export const CONFIGURATION_BACKUP_FORMAT_VERSION = 1;

const backupRowSchema = z.record(z.unknown());
const backupRows = (max = 10000) => z.array(backupRowSchema).max(max);

const backupDataSchema = z.object({
  rooms: backupRows(1000),
  devices: backupRows(),
  device_preferences: backupRows(),
  device_homekit_settings: backupRows(),
  adapter_settings: backupRows(20),
  openccu_settings: backupRows(10),
  fritzbox_presence_settings: backupRows(10),
  fritzbox_presence_transport_settings: backupRows(10),
  presence_targets: backupRows(1000),
  presence_target_profiles: backupRows(1000).optional(),
  device_adapter_data: backupRows(),
  automations: backupRows(),
  automation_preferences: backupRows(),
  automation_time_triggers: backupRows().optional(),
  automation_conditions: backupRows().optional(),
  automation_triggers: backupRows(),
  automation_actions: backupRows().optional(),
  automation_targets: backupRows().optional(),
  automation_system_actions: backupRows().optional(),
  climate_mode_settings: backupRows(10),
  notification_settings: backupRows(10),
  notification_state: backupRows(100)
}).strict();

const backupSchema = z.object({
  format: z.literal(CONFIGURATION_BACKUP_FORMAT),
  formatVersion: z.literal(CONFIGURATION_BACKUP_FORMAT_VERSION),
  schemaVersion: z.string().min(1).max(32),
  saltaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  createdAt: z.string().datetime(),
  containsEncryptedSecrets: z.boolean(),
  data: backupDataSchema,
  signature: z.string().min(20).max(256)
}).strict();

export type ConfigurationBackup = z.infer<typeof backupSchema>;

type BackupData = z.infer<typeof backupDataSchema>;
type NormalizedBackupData = Omit<BackupData, "presence_target_profiles" | "automation_time_triggers" | "automation_conditions" | "automation_actions" | "automation_targets" | "automation_system_actions"> & { presence_target_profiles: Record<string, unknown>[]; automation_time_triggers: Record<string, unknown>[]; automation_conditions: Record<string, unknown>[]; automation_actions: Record<string, unknown>[]; automation_targets: Record<string, unknown>[]; automation_system_actions: Record<string, unknown>[] };
type BackupRow = Record<string, unknown>;

const exportQueries: Readonly<Record<keyof NormalizedBackupData, string>> = {
  rooms: "SELECT * FROM rooms ORDER BY sort_order,name,id",
  devices: "SELECT * FROM devices ORDER BY id",
  device_preferences: "SELECT * FROM device_preferences ORDER BY device_id",
  device_homekit_settings: "SELECT * FROM device_homekit_settings ORDER BY device_id",
  adapter_settings: "SELECT * FROM adapter_settings ORDER BY adapter_id",
  openccu_settings: "SELECT * FROM openccu_settings ORDER BY adapter_id",
  fritzbox_presence_settings: "SELECT * FROM fritzbox_presence_settings ORDER BY adapter_id",
  fritzbox_presence_transport_settings: "SELECT * FROM fritzbox_presence_transport_settings ORDER BY adapter_id",
  presence_targets: "SELECT * FROM presence_targets ORDER BY name,id",
  presence_target_profiles: "SELECT * FROM presence_target_profiles ORDER BY person_name,target_id",
  device_adapter_data: "SELECT * FROM device_adapter_data ORDER BY device_id",
  automations: "SELECT * FROM automations ORDER BY name,id",
  automation_preferences: "SELECT * FROM automation_preferences ORDER BY automation_id",
  automation_time_triggers: "SELECT * FROM automation_time_triggers ORDER BY automation_id",
  automation_conditions: "SELECT * FROM automation_conditions ORDER BY automation_id,position",
  automation_triggers: "SELECT * FROM automation_triggers ORDER BY automation_id,position",
  automation_actions: "SELECT * FROM automation_actions ORDER BY automation_id,position",
  automation_targets: "SELECT * FROM automation_targets ORDER BY automation_id,position",
  automation_system_actions: "SELECT * FROM automation_system_actions ORDER BY automation_id,position",
  climate_mode_settings: "SELECT * FROM climate_mode_settings ORDER BY id",
  notification_settings: "SELECT * FROM notification_settings ORDER BY channel",
  notification_state: "SELECT * FROM notification_state ORDER BY key"
};

const insertStatements: Readonly<Record<keyof NormalizedBackupData, string>> = {
  rooms: "INSERT INTO rooms SELECT * FROM jsonb_populate_recordset(NULL::rooms, $1::jsonb)",
  devices: "INSERT INTO devices SELECT * FROM jsonb_populate_recordset(NULL::devices, $1::jsonb)",
  device_preferences: "INSERT INTO device_preferences SELECT * FROM jsonb_populate_recordset(NULL::device_preferences, $1::jsonb)",
  device_homekit_settings: "INSERT INTO device_homekit_settings SELECT * FROM jsonb_populate_recordset(NULL::device_homekit_settings, $1::jsonb)",
  adapter_settings: "INSERT INTO adapter_settings SELECT * FROM jsonb_populate_recordset(NULL::adapter_settings, $1::jsonb)",
  openccu_settings: "INSERT INTO openccu_settings SELECT * FROM jsonb_populate_recordset(NULL::openccu_settings, $1::jsonb)",
  fritzbox_presence_settings: "INSERT INTO fritzbox_presence_settings SELECT * FROM jsonb_populate_recordset(NULL::fritzbox_presence_settings, $1::jsonb)",
  fritzbox_presence_transport_settings: "INSERT INTO fritzbox_presence_transport_settings SELECT * FROM jsonb_populate_recordset(NULL::fritzbox_presence_transport_settings, $1::jsonb)",
  presence_targets: "INSERT INTO presence_targets SELECT * FROM jsonb_populate_recordset(NULL::presence_targets, $1::jsonb)",
  presence_target_profiles: "INSERT INTO presence_target_profiles SELECT * FROM jsonb_populate_recordset(NULL::presence_target_profiles, $1::jsonb)",
  device_adapter_data: "INSERT INTO device_adapter_data SELECT * FROM jsonb_populate_recordset(NULL::device_adapter_data, $1::jsonb)",
  automations: "INSERT INTO automations SELECT * FROM jsonb_populate_recordset(NULL::automations, $1::jsonb)",
  automation_preferences: "INSERT INTO automation_preferences SELECT * FROM jsonb_populate_recordset(NULL::automation_preferences, $1::jsonb)",
  automation_time_triggers: "INSERT INTO automation_time_triggers SELECT * FROM jsonb_populate_recordset(NULL::automation_time_triggers, $1::jsonb)",
  automation_conditions: "INSERT INTO automation_conditions SELECT * FROM jsonb_populate_recordset(NULL::automation_conditions, $1::jsonb)",
  automation_triggers: "INSERT INTO automation_triggers SELECT * FROM jsonb_populate_recordset(NULL::automation_triggers, $1::jsonb)",
  automation_actions: "INSERT INTO automation_actions SELECT * FROM jsonb_populate_recordset(NULL::automation_actions, $1::jsonb)",
  automation_targets: "INSERT INTO automation_targets SELECT * FROM jsonb_populate_recordset(NULL::automation_targets, $1::jsonb)",
  automation_system_actions: "INSERT INTO automation_system_actions SELECT * FROM jsonb_populate_recordset(NULL::automation_system_actions, $1::jsonb)",
  climate_mode_settings: "INSERT INTO climate_mode_settings SELECT * FROM jsonb_populate_recordset(NULL::climate_mode_settings, $1::jsonb)",
  notification_settings: "INSERT INTO notification_settings SELECT * FROM jsonb_populate_recordset(NULL::notification_settings, $1::jsonb)",
  notification_state: "INSERT INTO notification_state SELECT * FROM jsonb_populate_recordset(NULL::notification_state, $1::jsonb)"
};

const insertOrder: readonly (keyof NormalizedBackupData)[] = [
  "rooms", "devices", "device_preferences", "device_homekit_settings", "adapter_settings", "openccu_settings",
  "fritzbox_presence_settings", "fritzbox_presence_transport_settings", "presence_targets", "presence_target_profiles", "device_adapter_data",
  "automations", "automation_preferences", "automation_time_triggers", "automation_conditions", "automation_triggers", "automation_actions", "automation_targets", "automation_system_actions", "climate_mode_settings", "notification_settings", "notification_state"
];

const deleteStatements = [
  "DELETE FROM notification_state",
  "DELETE FROM automation_system_actions",
  "DELETE FROM automation_targets",
  "DELETE FROM automation_actions",
  "DELETE FROM automation_triggers",
  "DELETE FROM automation_conditions",
  "DELETE FROM automation_time_triggers",
  "DELETE FROM automation_preferences",
  "DELETE FROM automations",
  "DELETE FROM device_adapter_data",
  "DELETE FROM device_homekit_settings",
  "DELETE FROM device_preferences",
  "DELETE FROM devices",
  "DELETE FROM presence_target_profiles",
  "DELETE FROM presence_targets",
  "DELETE FROM rooms",
  "DELETE FROM adapter_settings",
  "DELETE FROM openccu_settings",
  "DELETE FROM fritzbox_presence_transport_settings",
  "DELETE FROM fritzbox_presence_settings",
  "DELETE FROM climate_mode_settings",
  "DELETE FROM notification_settings"
] as const;

function unsignedBackup(backup: ConfigurationBackup): Omit<ConfigurationBackup, "signature"> {
  const { signature, ...unsigned } = backup;
  void signature;
  return unsigned;
}

function signatureFor(backup: Omit<ConfigurationBackup, "signature">, signingKey: string): string {
  return createHmac("sha256", signingKey).update(JSON.stringify(backup), "utf8").digest("base64url");
}

function signaturesMatch(expected: string, actual: string): boolean {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(actual, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function encryptedSecretsPresent(data: BackupData): boolean {
  const encrypted = (value: unknown) => typeof value === "string" && value.length > 0;
  return data.adapter_settings.some((row: BackupRow) => encrypted(row.encrypted_password))
    || data.openccu_settings.some((row: BackupRow) => encrypted(row.encrypted_password))
    || data.fritzbox_presence_settings.some((row: BackupRow) => encrypted(row.encrypted_password))
    || data.devices.some((row: BackupRow) => encrypted(row.credential_password))
    || data.notification_settings.some((row: BackupRow) => encrypted(row.encrypted_user_key) || encrypted(row.encrypted_api_token));
}

function validateEncryptedSecretShapes(data: BackupData): void {
  const values: unknown[] = [];
  for (const row of data.adapter_settings) values.push(row.encrypted_password);
  for (const row of data.openccu_settings) values.push(row.encrypted_password);
  for (const row of data.fritzbox_presence_settings) values.push(row.encrypted_password);
  for (const row of data.devices) values.push(row.credential_password);
  for (const row of data.notification_settings) values.push(row.encrypted_user_key, row.encrypted_api_token);
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value !== "string" || value.length > 4096 || !value.startsWith("v2.")) throw new Error("CONFIG_BACKUP_INVALID_SECRET");
  }
}

function sanitizeDeviceRows(rows: BackupRow[], createdAt: string): BackupRow[] {
  return rows.map(row => {
    const virtual = row.source === "virtual";
    return {
      ...row,
      reachable: virtual,
      state: virtual && row.state && typeof row.state === "object" ? row.state : {},
      last_seen: createdAt,
      last_event: createdAt,
      updated_at: createdAt
    };
  });
}

export async function createConfigurationBackup(saltaVersion: string, signingKey = config.SALTA_ENCRYPTION_KEY): Promise<ConfigurationBackup> {
  const createdAt = new Date().toISOString();
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const entries: [keyof NormalizedBackupData, BackupRow[]][] = [];
    for (const [key, sql] of Object.entries(exportQueries) as [keyof NormalizedBackupData, string][]) {
      entries.push([key, (await client.query<BackupRow>(sql)).rows]);
    }
    await client.query("COMMIT");
    const data = Object.fromEntries(entries) as NormalizedBackupData;
    data.devices = sanitizeDeviceRows(data.devices, createdAt);
    const unsigned: Omit<ConfigurationBackup, "signature"> = {
      format: CONFIGURATION_BACKUP_FORMAT,
      formatVersion: CONFIGURATION_BACKUP_FORMAT_VERSION,
      schemaVersion: DATABASE_SCHEMA_VERSION,
      saltaVersion,
      createdAt,
      containsEncryptedSecrets: encryptedSecretsPresent(data),
      data
    };
    return { ...unsigned, signature: signatureFor(unsigned, signingKey) };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* Preserve the export error. */ }
    throw error;
  } finally {
    client.release();
  }
}

export interface ConfigurationImportResult {
  importedAt: string;
  sourceVersion: string;
  rooms: number;
  devices: number;
  automations: number;
  presenceTargets: number;
  containsEncryptedSecrets: boolean;
}

export interface ConfigurationImportExternalTransaction {
  rollback(): Promise<void> | void;
  finalize?(): Promise<void> | void;
}

export interface ConfigurationImportOptions {
  beforeCommit?: () => Promise<ConfigurationImportExternalTransaction | void> | ConfigurationImportExternalTransaction | void;
}

export async function importConfigurationBackup(input: unknown, signingKey = config.SALTA_ENCRYPTION_KEY, options: ConfigurationImportOptions = {}): Promise<ConfigurationImportResult> {
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) throw new Error("CONFIG_BACKUP_INVALID");
  const backup = parsed.data;
  if (backup.schemaVersion !== DATABASE_SCHEMA_VERSION) throw new Error("CONFIG_BACKUP_SCHEMA_MISMATCH");
  const expectedSignature = signatureFor(unsignedBackup(backup), signingKey);
  if (!signaturesMatch(expectedSignature, backup.signature)) throw new Error("CONFIG_BACKUP_SIGNATURE_INVALID");
  validateEncryptedSecretShapes(backup.data);
  if (backup.containsEncryptedSecrets !== encryptedSecretsPresent(backup.data)) throw new Error("CONFIG_BACKUP_INVALID");
  // Older format-v1 backups may not contain additive presence-profile or automation schedule/condition/action tables.
  // Keep the signed input untouched for verification, then normalize it for restore.
  const restoreData: NormalizedBackupData = {
    ...backup.data,
    presence_target_profiles: backup.data.presence_target_profiles ?? [],
    automation_time_triggers: backup.data.automation_time_triggers ?? [],
    automation_conditions: backup.data.automation_conditions ?? [],
    automation_actions: backup.data.automation_actions ?? [],
    automation_targets: backup.data.automation_targets ?? [],
    automation_system_actions: backup.data.automation_system_actions ?? []
  };

  const client = await pool.connect();
  let externalTransaction: ConfigurationImportExternalTransaction | void = undefined;
  let committed = false;
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE rooms, devices, device_preferences, device_homekit_settings, adapter_settings, openccu_settings, fritzbox_presence_settings, fritzbox_presence_transport_settings, presence_targets, presence_target_profiles, device_adapter_data, automations, automation_preferences, automation_time_triggers, automation_conditions, automation_triggers, automation_actions, automation_targets, automation_system_actions, climate_mode_settings, notification_settings, notification_state IN ACCESS EXCLUSIVE MODE");
    for (const statement of deleteStatements) await client.query(statement);
    for (const table of insertOrder) {
      const rows = restoreData[table];
      if (!rows.length) continue;
      await client.query(insertStatements[table], [JSON.stringify(rows)]);
    }
    await client.query("INSERT INTO climate_mode_settings(id) VALUES('global') ON CONFLICT(id) DO NOTHING");
    await client.query("INSERT INTO notification_settings(channel) VALUES('pushover') ON CONFLICT(channel) DO NOTHING");
    externalTransaction = await options.beforeCommit?.();
    await client.query("COMMIT");
    committed = true;
  } catch (error) {
    if (!committed) {
      try { await client.query("ROLLBACK"); } catch { /* Preserve the restore error. */ }
      try { await externalTransaction?.rollback(); } catch { /* Preserve the restore error. */ }
    }
    throw new Error("CONFIG_BACKUP_IMPORT_FAILED", { cause: error });
  } finally {
    client.release();
  }
  if (committed) {
    try { await externalTransaction?.finalize?.(); } catch { /* Cleanup failure must not undo a committed restore. */ }
  }

  return {
    importedAt: new Date().toISOString(),
    sourceVersion: backup.saltaVersion,
    rooms: backup.data.rooms.length,
    devices: backup.data.devices.length,
    automations: backup.data.automations.length,
    presenceTargets: backup.data.presence_targets.length,
    containsEncryptedSecrets: backup.containsEncryptedSecrets
  };
}
