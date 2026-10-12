import type { FastifyInstance } from "fastify";
import type { Device, HomeKitStatus, PresenceTarget } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import type { PhosconAdapter } from "./phoscon-adapter.js";
import type { HueAdapter } from "./hue-adapter.js";
import type { OpenCcuAdapter } from "./openccu-adapter.js";
import type { FritzBoxPresenceAdapter } from "./fritzbox-presence.js";
import type { ClimateModeManager } from "./climate-mode.js";
import type { VacationModeManager } from "./vacation-mode.js";
import type { HomeKitBridge } from "./homekit.js";
import { config } from "./config.js";
import { assertDiagnosticDoesNotContainSecrets, sanitizeDiagnosticValue } from "./diagnostic-sanitizer.js";
import {
  getClimateModeSettings,
  getFritzBoxPresenceConnection,
  getFritzBoxPresenceSettings,
  getGeneralSettings,
  getGlobalShellyCredentials,
  getHomeKitSettings,
  getHueConnection,
  getHueSettings,
  getOpenCcuConnection,
  getOpenCcuSettings,
  getPhosconConnection,
  getPhosconSettings,
  getPushoverConnection,
  getPushoverSettings,
  getShellySettings,
  getVacationModeSettings,
  listAutomations,
  listPresenceTargets,
  listRooms,
  listSystemLogs,
  writeSystemLog
} from "./db.js";

export const DIAGNOSTIC_EXPORT_FORMAT = "salta-sanitized-diagnostic-export";
export const DIAGNOSTIC_EXPORT_FORMAT_VERSION = 1;

function safeDevice(device: Device): unknown {
  const {
    credentialUsername: _credentialUsername,
    ...withoutCredentialUsername
  } = device;
  void _credentialUsername;
  return sanitizeDiagnosticValue(withoutCredentialUsername);
}

function safePresenceTarget(target: PresenceTarget): Record<string, unknown> {
  return {
    id: target.id,
    name: target.name,
    personName: target.personName,
    absenceDelaySeconds: target.absenceDelaySeconds ?? null,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt
  };
}

function safeHomeKitStatus(status: HomeKitStatus): Record<string, unknown> {
  return {
    enabled: status.enabled,
    name: status.name,
    networkInterface: status.networkInterface,
    running: status.running,
    paired: status.paired,
    advertised: status.advertised,
    listeningAddress: status.listeningAddress,
    listeningPort: status.listeningPort,
    port: status.port,
    lastError: status.lastError,
    supportedDevices: status.supportedDevices,
    publishedDevices: status.publishedDevices,
    networkInterfaces: status.networkInterfaces
  };
}

function nonEmptySecret(value: unknown): string | undefined {
  return typeof value === "string" && value.length >= 4 ? value : undefined;
}

interface DiagnosticExportDependencies {
  registry: Pick<DeviceRegistry, "all">;
  phoscon: Pick<PhosconAdapter, "getStatus">;
  hue: Pick<HueAdapter, "getStatus">;
  openCcu: Pick<OpenCcuAdapter, "getStatus">;
  presence: Pick<FritzBoxPresenceAdapter, "getStatus">;
  climate: Pick<ClimateModeManager, "status">;
  vacation: Pick<VacationModeManager, "status">;
  homekit: Pick<HomeKitBridge, "status">;
  saltaVersion: string;
}

async function knownSecrets(): Promise<string[]> {
  const safe = async <T>(load: () => Promise<T>): Promise<T | undefined> => {
    try { return await load(); } catch { return undefined; }
  };
  const [
    shelly,
    phoscon,
    hue,
    openCcu,
    fritzBox,
    pushover,
    homeKit
  ] = await Promise.all([
    safe(() => getGlobalShellyCredentials()),
    safe(() => getPhosconConnection()),
    safe(() => getHueConnection()),
    safe(() => getOpenCcuConnection()),
    safe(() => getFritzBoxPresenceConnection()),
    safe(() => getPushoverConnection()),
    safe(() => getHomeKitSettings())
  ]);
  return [
    config.ADMIN_PASSWORD,
    config.SALTA_HEALTH_TOKEN,
    config.SALTA_ENCRYPTION_KEY,
    config.DATABASE_URL,
    config.HOMEKIT_PIN,
    shelly?.password,
    phoscon?.apiKey,
    hue?.applicationKey,
    openCcu?.password,
    fritzBox?.password,
    pushover?.userKey,
    pushover?.apiToken,
    homeKit?.pin
  ].map(nonEmptySecret).filter((value): value is string => Boolean(value));
}

export async function createSanitizedDiagnosticExport(deps: DiagnosticExportDependencies): Promise<Record<string, unknown>> {
  const exportedAt = new Date().toISOString();
  const [
    rooms,
    automations,
    logs,
    general,
    climateSettings,
    vacationSettings,
    shellySettings,
    phosconSettings,
    hueSettings,
    openCcuSettings,
    fritzBoxSettings,
    pushoverSettings,
    presenceTargets,
    climateStatus,
    vacationStatus,
    homeKitStatus,
    secrets
  ] = await Promise.all([
    listRooms(),
    listAutomations(),
    listSystemLogs(100),
    getGeneralSettings(),
    getClimateModeSettings(),
    getVacationModeSettings(),
    getShellySettings(),
    getPhosconSettings(),
    getHueSettings(),
    getOpenCcuSettings(),
    getFritzBoxPresenceSettings(),
    getPushoverSettings(),
    listPresenceTargets(),
    deps.climate.status(),
    deps.vacation.status(),
    deps.homekit.status(),
    knownSecrets()
  ]);

  const payload = sanitizeDiagnosticValue({
    format: DIAGNOSTIC_EXPORT_FORMAT,
    formatVersion: DIAGNOSTIC_EXPORT_FORMAT_VERSION,
    exportedAt,
    saltaVersion: deps.saltaVersion,
    credentialSafety: {
      credentialsIncluded: false,
      secretGuardVerified: true,
      excluded: [
        "passwords",
        "API/application/user keys",
        "tokens and sessions",
        "HomeKit PIN/setup URI",
        "credential usernames",
        "encrypted secret fields",
        "presence MAC/IP addresses"
      ]
    },
    runtime: {
      timeZone: config.TZ,
      webPort: config.WEB_PORT,
      logLevel: config.LOG_LEVEL,
      homeKitEnabledByEnvironment: config.HOMEKIT_ENABLED,
      homeKitPort: config.HOMEKIT_PORT
    },
    settings: {
      general,
      climateMode: climateSettings,
      vacationMode: vacationSettings,
      shelly: {
        passwordConfigured: shellySettings.passwordConfigured,
        encryptionStatus: shellySettings.encryptionStatus,
        invalidDeviceCredentials: shellySettings.invalidDeviceCredentials
      },
      phoscon: {
        baseUrl: phosconSettings.baseUrl,
        apiKeyConfigured: phosconSettings.apiKeyConfigured,
        encryptionStatus: phosconSettings.encryptionStatus
      },
      hue: {
        baseUrl: hueSettings.baseUrl,
        applicationKeyConfigured: hueSettings.applicationKeyConfigured,
        encryptionStatus: hueSettings.encryptionStatus
      },
      openCcu: {
        baseUrl: openCcuSettings.baseUrl,
        passwordConfigured: openCcuSettings.passwordConfigured,
        encryptionStatus: openCcuSettings.encryptionStatus
      },
      fritzBoxPresence: {
        baseUrl: fritzBoxSettings.baseUrl,
        passwordConfigured: fritzBoxSettings.passwordConfigured,
        encryptionStatus: fritzBoxSettings.encryptionStatus,
        enabled: fritzBoxSettings.enabled,
        pollIntervalSeconds: fritzBoxSettings.pollIntervalSeconds,
        absenceDelaySeconds: fritzBoxSettings.absenceDelaySeconds,
        tlsInsecure: fritzBoxSettings.tlsInsecure
      },
      pushover: pushoverSettings
    },
    statuses: {
      phoscon: deps.phoscon.getStatus(),
      hue: deps.hue.getStatus(),
      openCcu: deps.openCcu.getStatus(),
      fritzBoxPresence: deps.presence.getStatus(),
      climate: climateStatus,
      vacation: vacationStatus,
      homeKit: safeHomeKitStatus(homeKitStatus)
    },
    rooms,
    presenceTargets: presenceTargets.map(safePresenceTarget),
    automations,
    devices: deps.registry.all().map(safeDevice),
    systemLogs: {
      retention: { maxEntries: 100, maxAgeDays: 30 },
      entries: logs
    }
  }) as Record<string, unknown>;

  assertDiagnosticDoesNotContainSecrets(payload, secrets);
  return payload;
}

export function registerDiagnosticExportRoute(server: FastifyInstance, deps: DiagnosticExportDependencies): void {
  server.get("/api/diagnostics/export", async (_request, reply) => {
    const payload = await createSanitizedDiagnosticExport(deps);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    reply.header("cache-control", "no-store");
    reply.header("content-disposition", `attachment; filename="SALTA-diagnostic-${deps.saltaVersion}-${stamp}.json"`);
    await writeSystemLog("info", "system", "DIAGNOSTIC_EXPORT_CREATED", "Sanitized SALTA diagnostic export created", {
      version: deps.saltaVersion,
      devices: deps.registry.all().length,
      formatVersion: DIAGNOSTIC_EXPORT_FORMAT_VERSION
    }).catch(() => undefined);
    return payload;
  });
}
