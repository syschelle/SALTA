import type { BatteryWarningDevice, Device } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import { getNotificationLastSent, getPushoverConnection, getPushoverSettings, setNotificationLastSent, writeSystemLog } from "./db.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const NOTIFICATION_KEY = "battery-warning";

export interface BatteryMonitorStatus {
  enabled: boolean;
  configured: boolean;
  batteryThreshold: number;
  warnings: BatteryWarningDevice[];
  lastSentAt?: string;
  nextEligibleAt?: string;
}

type PushoverSender = (input: { userKey: string; apiToken: string; title: string; message: string }) => Promise<void>;

function batteryPercent(device: Device): number | undefined {
  const value = Number(device.state?.battery);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : undefined;
}

export function batteryWarnings(devices: Device[], threshold: number): BatteryWarningDevice[] {
  const warnings = new Map<string, BatteryWarningDevice>();
  for (const device of devices) {
    const battery = batteryPercent(device);
    const lowBattery = device.state?.lowBattery === true;
    if (!lowBattery && (battery === undefined || battery > threshold)) continue;
    const physicalKey = `${device.source}:${device.macAddress || device.host || device.sourceId || device.id}`;
    const candidate: BatteryWarningDevice = {
      deviceId: device.id,
      name: device.name,
      ...(device.room ? { room: device.room } : {}),
      ...(battery !== undefined ? { battery: Math.round(battery) } : {}),
      lowBattery
    };
    const current = warnings.get(physicalKey);
    if (!current || (candidate.battery ?? 101) < (current.battery ?? 101)) warnings.set(physicalKey, candidate);
  }
  return [...warnings.values()].sort((a, b) => (a.battery ?? 101) - (b.battery ?? 101) || a.name.localeCompare(b.name));
}

function batteryMessage(warnings: BatteryWarningDevice[], threshold: number): string {
  const heading = `${warnings.length} ${warnings.length === 1 ? "Gerät hat" : "Geräte haben"} einen niedrigen Batteriestand (Grenze ${threshold} %).`;
  const lines = warnings.map(item => `• ${item.name}${item.room ? ` (${item.room})` : ""}: ${item.battery !== undefined ? `${item.battery} %` : "Batteriewarnung aktiv"}`);
  let message = [heading, ...lines].join("\n");
  if (message.length > 1000) message = `${message.slice(0, 997)}…`;
  return message;
}

export async function sendPushoverMessage(input: { userKey: string; apiToken: string; title: string; message: string }): Promise<void> {
  const body = new URLSearchParams({
    token: input.apiToken,
    user: input.userKey,
    title: input.title,
    message: input.message,
    priority: "0"
  });
  const response = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "SALTA/0.8"
    },
    body,
    signal: AbortSignal.timeout(10_000)
  });
  const payload = await response.json().catch(() => ({})) as { status?: number; errors?: unknown };
  if (!response.ok || payload.status !== 1) throw new Error(`PUSHOVER_REQUEST_FAILED:${response.status}`);
}

export class BatteryMonitor {
  private timer?: NodeJS.Timeout;
  private debounce?: NodeJS.Timeout;
  private started = false;
  private readonly onDevice = (): void => {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.evaluate().catch(() => undefined), 30_000);
    this.debounce.unref();
  };

  constructor(
    private readonly registry: DeviceRegistry,
    private readonly sender: PushoverSender = sendPushoverMessage
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.registry.on("device", this.onDevice);
    this.timer = setInterval(() => void this.evaluate().catch(() => undefined), CHECK_INTERVAL_MS);
    this.timer.unref();
    const initial = setTimeout(() => void this.evaluate().catch(() => undefined), 15_000);
    initial.unref();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.registry.off("device", this.onDevice);
    if (this.timer) clearInterval(this.timer);
    if (this.debounce) clearTimeout(this.debounce);
    this.timer = undefined;
    this.debounce = undefined;
  }

  async status(): Promise<BatteryMonitorStatus> {
    const settings = await getPushoverSettings();
    const warnings = batteryWarnings(this.registry.all(), settings.batteryThreshold);
    const lastSentAt = await getNotificationLastSent(NOTIFICATION_KEY);
    const lastMs = lastSentAt ? Date.parse(lastSentAt) : Number.NaN;
    return {
      enabled: settings.enabled,
      configured: settings.userKeyConfigured && settings.apiTokenConfigured && settings.encryptionStatus === "ok",
      batteryThreshold: settings.batteryThreshold,
      warnings,
      ...(lastSentAt ? { lastSentAt } : {}),
      ...(Number.isFinite(lastMs) ? { nextEligibleAt: new Date(lastMs + WEEK_MS).toISOString() } : {})
    };
  }

  async test(): Promise<void> {
    const connection = await getPushoverConnection();
    if (!connection.userKey || !connection.apiToken) throw new Error("PUSHOVER_NOT_CONFIGURED");
    await this.sender({ userKey: connection.userKey, apiToken: connection.apiToken, title: "SALTA Testnachricht", message: "Pushover ist erfolgreich mit SALTA verbunden." });
  }

  async evaluate(now = new Date()): Promise<BatteryMonitorStatus> {
    const connection = await getPushoverConnection();
    const warnings = batteryWarnings(this.registry.all(), connection.batteryThreshold);
    const lastSentAt = await getNotificationLastSent(NOTIFICATION_KEY);
    const lastMs = lastSentAt ? Date.parse(lastSentAt) : Number.NaN;
    const eligible = !Number.isFinite(lastMs) || now.getTime() - lastMs >= WEEK_MS;

    if (connection.enabled && connection.userKey && connection.apiToken && warnings.length && eligible) {
      try {
        await this.sender({
          userKey: connection.userKey,
          apiToken: connection.apiToken,
          title: "SALTA Batteriewarnung",
          message: batteryMessage(warnings, connection.batteryThreshold)
        });
        await setNotificationLastSent(NOTIFICATION_KEY, now.toISOString(), { warningCount: warnings.length, deviceIds: warnings.map(item => item.deviceId) });
        await writeSystemLog("warning", "notification", "BATTERY_WARNING_SENT", "Battery warning sent via Pushover", {
          warningCount: warnings.length,
          threshold: connection.batteryThreshold,
          deviceIds: warnings.map(item => item.deviceId)
        }).catch(() => undefined);
      } catch (error) {
        await writeSystemLog("error", "notification", "PUSHOVER_SEND_FAILED", "Pushover battery warning could not be sent", {
          warningCount: warnings.length,
          error: error instanceof Error ? error.message : String(error)
        }).catch(() => undefined);
      }
    }
    return this.status();
  }
}
