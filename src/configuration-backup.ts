import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { config } from "./config.js";
import { DATABASE_SCHEMA_VERSION, pool } from "./db.js";

export const CONFIGURATION_BACKUP_FORMAT = "salta-configuration-backup";
export const CONFIGURATION_BACKUP_FORMAT_VERSION = 1;

const backupRowSchema = z.record(z.string(), z.unknown());
const backupRows = (max = 10000) => z.array(backupRowSchema).max(max);

const backupDataSchema = z.object({
  rooms: backupRows(1000),
  devices: backupRows(),
  device_preferences: backupRows(),
  device_favorites: backupRows().optional(),
  device_homekit_settings: backupRows(),
  adapter_settings: backupRows(20),
  openccu_settings: backupRows(10),
  fritzbox_presence_settings: backupRows(10),
  fritzbox_presence_transport_settings: backupRows(10),
  presence_targets: backupRows(1000),
  presence_target_profiles: backupRows(1000).optional(),
  presence_target_network: backupRows(1000).optional(),
  device_adapter_data: backupRows(),
  automations: backupRows(),
  automation_preferences: backupRows(),
  automation_time_triggers: backupRows().optional(),
  automation_schedule_preferences: backupRows().optional(),
  automation_action_preferences: backupRows().optional(),
  automation_action_state: backupRows().optional(),
  automation_action_delays: backupRows().optional(),
  automation_conditions: backupRows().optional(),
  runtime_settings: backupRows(1000),
  system_settings: backupRows(1000).optional(),
  color_profiles: backupRows(1000).optional(),
  notification_settings: backupRows(1000).optional(),
  notification_events: backupRows(10000).optional()
}).strict();

const backupEnvelopeSchema = z.object({
  format: z.literal(CONFIGURATION_BACKUP_FORMAT),
  formatVersion: z.literal(CONFIGURATION_BACKUP_FORMAT_VERSION),
  schemaVersion: z.string().min(1).max(32),
  createdAt: z.string().datetime(),
  saltaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  data: backupDataSchema,
  signature: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();

type BackupData = z.infer<typeof backupDataSchema>;
type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>;

function signaturePayload(envelope: Omit<BackupEnvelope, "signature">): string {
  return JSON.stringify(envelope);
}

function backupSecret(): string {
  const secret = config.configurationBackupSecret?.trim();
  if (!secret) throw new Error("CONFIGURATION_BACKUP_SECRET_MISSING");
  return secret;
}

function signEnvelope(envelope: Omit<BackupEnvelope, "signature">): string {
  return createHmac("sha256", backupSecret()).update(signaturePayload(envelope)).digest("hex");
}

function verifySignature(envelope: BackupEnvelope): void {
  const expected = Buffer.from(signEnvelope({
    format: envelope.format,
    formatVersion: envelope.formatVersion,
    schemaVersion: envelope.schemaVersion,
    createdAt: envelope.createdAt,
    saltaVersion: envelope.saltaVersion,
    data: envelope.data
  }), "hex");
  const received = Buffer.from(envelope.signature, "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("CONFIGURATION_BACKUP_SIGNATURE_INVALID");
}

async function tableExists(table: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>("SELECT to_regclass($1) IS NOT NULL AS exists", [`public.${table}`]);
  return Boolean(result.rows[0]?.exists);
}

async function readTable(table: string): Promise<Record<string, unknown>[]> {
  if (!await tableExists(table)) return [];
  const result = await pool.query(`SELECT * FROM ${table}`);
  return result.rows as Record<string, unknown>[];
}

const backupTables = [
  "rooms",
  "devices",
  "device_preferences",
  "device_favorites",
  "device_homekit_settings",
  "adapter_settings",
  "openccu_settings",
  "fritzbox_presence_settings",
  "fritzbox_presence_transport_settings",
  "presence_targets",
  "presence_target_profiles",
  "presence_target_network",
  "device_adapter_data",
  "automations",
  "automation_preferences",
  "automation_time_triggers",
  "automation_schedule_preferences",
  "automation_action_preferences",
  "automation_action_state",
  "automation_action_delays",
  "automation_conditions",
  "runtime_settings",
  "system_settings",
  "color_profiles",
  "notification_settings",
  "notification_events"
] as const;

export async function createConfigurationBackup(saltaVersion: string): Promise<BackupEnvelope> {
  const data = {} as Record<(typeof backupTables)[number], Record<string, unknown>[]>;
  for (const table of backupTables) data[table] = await readTable(table);
  const envelope = {
    format: CONFIGURATION_BACKUP_FORMAT,
    formatVersion: CONFIGURATION_BACKUP_FORMAT_VERSION,
    schemaVersion: DATABASE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    saltaVersion,
    data: backupDataSchema.parse(data)
  } as const;
  return { ...envelope, signature: signEnvelope(envelope) };
}

async function truncateTables(client: Awaited<ReturnType<typeof pool.connect>>, tables: readonly string[]): Promise<void> {
  const existing: string[] = [];
  for (const table of tables) {
    const result = await client.query<{ exists: boolean }>("SELECT to_regclass($1) IS NOT NULL AS exists", [`public.${table}`]);
    if (result.rows[0]?.exists) existing.push(table);
  }
  if (existing.length > 0) await client.query(`TRUNCATE ${existing.join(", ")} RESTART IDENTITY CASCADE`);
}

async function restoreRows(client: Awaited<ReturnType<typeof pool.connect>>, table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  for (const row of rows) {
    const columns = Object.keys(row);
    if (columns.length === 0) continue;
    const values = columns.map((column) => row[column]);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    await client.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`, values);
  }
}

export async function restoreConfigurationBackup(input: unknown): Promise<{ restoredTables: string[] }> {
  const envelope = backupEnvelopeSchema.parse(input);
  verifySignature(envelope);
  if (envelope.schemaVersion !== DATABASE_SCHEMA_VERSION) throw new Error(`CONFIGURATION_BACKUP_SCHEMA_MISMATCH:${envelope.schemaVersion}:${DATABASE_SCHEMA_VERSION}`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await truncateTables(client, [...backupTables].reverse());
    const restoredTables: string[] = [];
    for (const table of backupTables) {
      const rows = envelope.data[table] ?? [];
      await restoreRows(client, table, rows);
      if (rows.length > 0) restoredTables.push(table);
    }
    await client.query("COMMIT");
    return { restoredTables };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
