import type { BatteryWarningDevice, Device } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import { getNotificationLastSent, getPushoverConnection, getPushoverSettings, setNotificationLastSent, writeSystemLog } from "./db.js";
import { sendPushoverMessage, type PushoverSender } from "./pushover.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const NOTIFICATION_KEY = "battery-warning";
const OPENCCU_NOTIFICATION_KEY = "openccu-device-warning";

export interface OpenCcuWarningDevice extends BatteryWarningDevice {
  unreachable: boolean;
}

export interface BatteryMonitorStatus {
  enabled: boolean;
  configured: boolean;
  batteryThreshold: number;
  warnings: BatteryWarningDevice[];
  openCcuWarnings: OpenCcuWarningDevice[];
  lastSentAt?: string;
  nextEligibleAt?: string;
  openCcuLastSentAt?: string;
  openCcuNextEligibleAt?: string;
}

function batteryPercent(device: Device): number | undefined {
  const value = Number(device.state?.battery);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : undefined;
}

function physicalKey(device: Device): string {
  return `${device.source}:${device.macAddress || device.host || device.sourceId || device.id}`;
}

export function batteryWarnings(devices: Device[], threshold: number): BatteryWarningDevice[] {
  const warnings = new Map<string, BatteryWarningDevice>();
  for (const device of devices) {
    const battery = batteryPercent(device);
    const lowBattery = device.state?.lowBattery === true;
    if (!lowBattery && (battery === undefined || battery > threshold)) continue;
    const candidate: BatteryWarningDevice = {
      deviceId: device.id,
      name: device.name,
      ...(device.room ? { room: device.room } : {}),
      ...(battery !== undefined ? { battery: Math.round(battery) } : {}),
      lowBattery
    };
    const key = physicalKey(device);
    const current = warnings.get(key);
    if (!current || (candidate.battery ?? 101) < (current.battery ?? 101)) warnings.set(key, candidate);
  }
  return [...warnings.values()].sort((a, b) => (a.battery ?? 101) - (b.battery ?? 101) || a.name.localeCompare(b.name));
}

export function openCcuWarnings(devices: Device[], threshold: number): OpenCcuWarningDevice[] {
  const warnings = new Map<string, OpenCcuWarningDevice>();
  for (const device of devices) {
    if (device.source !== "openccu") continue;
    const battery = batteryPercent(device);
    const lowBattery = device.state?.lowBattery === true;
    const unreachable = !device.reachable;
    const batteryBelowThreshold = battery !== undefined && battery <= threshold;
    if (!lowBattery && !batteryBelowThreshold && !unreachable) continue;

    const key = physicalKey(device);
    const current = warnings.get(key);
    const candidate: OpenCcuWarningDevice = {
      deviceId: device.id,
      name: device.name,
      ...(device.room ? { room: device.room } : {}),
      ...(battery !== undefined ? { battery: Math.round(battery) } : {}),
      lowBattery,
      unreachable
    };
    if (!current) {
      warnings.set(key, candidate);
      continue;
    }
    const currentBattery = current.battery;
    const candidateBattery = candidate.battery;
    warnings.set(key, {
      ...current,
      ...(currentBattery === undefined && candidateBattery !== undefined
        ? { battery: candidateBattery }
        : currentBattery !== undefined && candidateBattery !== undefined
          ? { battery: Math.min(currentBattery, candidateBattery) }
          : {}),
      lowBattery: current.lowBattery || candidate.lowBattery,
      unreachable: current.unreachable || candidate.unreachable
    });
  }
  return [...warnings.values()].sort((a, b) => Number(b.unreachable) - Number(a.unreachable) || (a.battery ?? 101) - (b.battery ?? 101) || a.name.localeCompare(b.name));
}

function batteryMessage(warnings: BatteryWarningDevice[], threshold: number): string {
  const heading = `${warnings.length} ${warnings.length === 1 ? "Gerät hat" : "Geräte haben"} einen niedrigen Batteriestand (Grenze ${threshold} %).`;
  const lines = warnings.map(item => `• ${item.name}${item.room ? ` (${item.room})` : ""}: ${item.battery !== undefined ? `${item.battery} %` : "Batteriewarnung aktiv"}`);
  let message = [heading, ...lines].join("\n");
  if (message.length > 1000) message = `${message.slice(0, 997)}…`;
  return message;
}

function openCcuMessage(warnings: OpenCcuWarningDevice[], threshold: number): string {
  const heading = `${warnings.length} OpenCCU/HomeMatic-${warnings.length === 1 ? "Gerät benötigt" : "Geräte benötigen"} Aufmerksamkeit.`;
  const lines = warnings.map(item => {
    const reasons: string[] = [];
    if (item.battery !== undefined && item.battery <= threshold) reasons.push(`Batterie ${item.battery} %`);
    else if (item.lowBattery) reasons.push("Batteriewarnung aktiv");
    if (item.unreachable) reasons.push("nicht erreichbar");
    return `• ${item.name}${item.room ? ` (${item.room})` : ""}: ${reasons.join(" · ")}`;
  });
  let message = [heading, ...lines].join("\n");
  if (message.length > 1000) message = `${message.slice(0, 997)}…`;
  return message;
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
    const devices = this.registry.all();
    const warnings = batteryWarnings(devices, settings.batteryThreshold);
    const openCcu = openCcuWarnings(devices, settings.batteryThreshold);
    const [lastSentAt, openCcuLastSentAt] = await Promise.all([
      getNotificationLastSent(NOTIFICATION_KEY),
      getNotificationLastSent(OPENCCU_NOTIFICATION_KEY)
    ]);
    const lastMs = lastSentAt ? Date.parse(lastSentAt) : Number.NaN;
    const openCcuLastMs = openCcuLastSentAt ? Date.parse(openCcuLastSentAt) : Number.NaN;
    return {
      enabled: settings.enabled,
      configured: settings.userKeyConfigured && settings.apiTokenConfigured && settings.encryptionStatus === "ok",
      batteryThreshold: settings.batteryThreshold,
      warnings,
      openCcuWarnings: openCcu,
      ...(lastSentAt ? { lastSentAt } : {}),
      ...(Number.isFinite(lastMs) ? { nextEligibleAt: new Date(lastMs + WEEK_MS).toISOString() } : {}),
      ...(openCcuLastSentAt ? { openCcuLastSentAt } : {}),
      ...(Number.isFinite(openCcuLastMs) ? { openCcuNextEligibleAt: new Date(openCcuLastMs + DAY_MS).toISOString() } : {})
    };
  }

  async test(): Promise<void> {
    const connection = await getPushoverConnection();
    if (!connection.userKey || !connection.apiToken) throw new Error("PUSHOVER_NOT_CONFIGURED");
    await this.sender({ userKey: connection.userKey, apiToken: connection.apiToken, title: "SALTA Testnachricht", message: "Pushover ist erfolgreich mit SALTA verbunden." });
  }

  async evaluate(now = new Date()): Promise<BatteryMonitorStatus> {
    const connection = await getPushoverConnection();
    const devices = this.registry.all();
    const generalWarnings = batteryWarnings(devices.filter(device => device.source !== "openccu"), connection.batteryThreshold);
    const openCcu = openCcuWarnings(devices, connection.batteryThreshold);
    const [lastSentAt, openCcuLastSentAt] = await Promise.all([
      getNotificationLastSent(NOTIFICATION_KEY),
      getNotificationLastSent(OPENCCU_NOTIFICATION_KEY)
    ]);
    const lastMs = lastSentAt ? Date.parse(lastSentAt) : Number.NaN;
    const openCcuLastMs = openCcuLastSentAt ? Date.parse(openCcuLastSentAt) : Number.NaN;
    const generalEligible = !Number.isFinite(lastMs) || now.getTime() - lastMs >= WEEK_MS;
    const openCcuEligible = !Number.isFinite(openCcuLastMs) || now.getTime() - openCcuLastMs >= DAY_MS;
    const canSend = connection.enabled && Boolean(connection.userKey) && Boolean(connection.apiToken);

    if (canSend && generalWarnings.length && generalEligible) {
      try {
        await this.sender({
          userKey: connection.userKey,
          apiToken: connection.apiToken,
          title: "SALTA Batteriewarnung",
          message: batteryMessage(generalWarnings, connection.batteryThreshold)
        });
        await setNotificationLastSent(NOTIFICATION_KEY, now.toISOString(), { warningCount: generalWarnings.length, deviceIds: generalWarnings.map(item => item.deviceId) });
        await writeSystemLog("warning", "notification", "BATTERY_WARNING_SENT", "Battery warning sent via Pushover", {
          warningCount: generalWarnings.length,
          threshold: connection.batteryThreshold,
          deviceIds: generalWarnings.map(item => item.deviceId)
        }).catch(() => undefined);
      } catch (error) {
        await writeSystemLog("error", "notification", "PUSHOVER_SEND_FAILED", "Pushover battery warning could not be sent", {
          warningCount: generalWarnings.length,
          error: error instanceof Error ? error.message : String(error)
        }).catch(() => undefined);
      }
    }

    if (canSend && openCcu.length && openCcuEligible) {
      try {
        await this.sender({
          userKey: connection.userKey,
          apiToken: connection.apiToken,
          title: "SALTA OpenCCU/HomeMatic Warnung",
          message: openCcuMessage(openCcu, connection.batteryThreshold)
        });
        await setNotificationLastSent(OPENCCU_NOTIFICATION_KEY, now.toISOString(), {
          warningCount: openCcu.length,
          deviceIds: openCcu.map(item => item.deviceId),
          lowBatteryDeviceIds: openCcu.filter(item => item.lowBattery || (item.battery !== undefined && item.battery <= connection.batteryThreshold)).map(item => item.deviceId),
          unreachableDeviceIds: openCcu.filter(item => item.unreachable).map(item => item.deviceId)
        });
        await writeSystemLog("warning", "notification", "OPENCCU_DEVICE_WARNING_SENT", "OpenCCU/HomeMatic battery or reachability warning sent via Pushover", {
          warningCount: openCcu.length,
          threshold: connection.batteryThreshold,
          lowBatteryDeviceIds: openCcu.filter(item => item.lowBattery || (item.battery !== undefined && item.battery <= connection.batteryThreshold)).map(item => item.deviceId),
          unreachableDeviceIds: openCcu.filter(item => item.unreachable).map(item => item.deviceId)
        }).catch(() => undefined);
      } catch (error) {
        await writeSystemLog("error", "notification", "PUSHOVER_OPENCCU_WARNING_FAILED", "OpenCCU/HomeMatic Pushover warning could not be sent", {
          warningCount: openCcu.length,
          error: error instanceof Error ? error.message : String(error)
        }).catch(() => undefined);
      }
    }

    return this.status();
  }
}
