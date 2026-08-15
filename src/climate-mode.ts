import type { ClimateMode, ClimateModeSettings, Device, DeviceCommand, DeviceState, WinterThermostatMode } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import { CLIMATE_MODE_AUTOMATION_DEVICE_ID } from "./automations.js";
import { getClimateModeSettings, getGeneralSettings, getPushoverConnection, updateClimateModeSettings, updateClimateWinterMode, writeSystemLog } from "./db.js";
import { sendPushoverMessage, type PushoverSender } from "./pushover.js";

const SUMMER_GUARD_INTERVAL_MS = 12 * 60 * 60 * 1000;
const SUMMER_GUARD_INITIAL_DELAY_MS = 2 * 60 * 1000;

export interface ClimateModeStatus extends ClimateModeSettings {
  thermostats: number;
  supportedThermostats: number;
}

export interface SummerGuardResult {
  mode: ClimateMode;
  checked: number;
  mismatched: number;
  corrected: number;
  failed: number;
}

type Commander = { command(command: DeviceCommand): Promise<Device> };
type ClimateRegistry = Pick<DeviceRegistry, "all"> & Partial<Pick<DeviceRegistry, "get" | "set">>;

export function thermostatSupportsSystemMode(device: Device): boolean {
  if (device.type !== "thermostat") return false;
  if (device.capabilities.includes("setThermostatMode")) return true;
  return device.source === "openccu"
    && device.capabilities.includes("setTargetTemperature")
    && typeof device.state.controlMode === "string";
}

function thermostatIsOff(device: Device): boolean {
  return String(device.state.controlMode ?? "").trim().toLowerCase() === "off";
}

function debugGuardMessage(result: SummerGuardResult, correctedNames: string[], failures: Array<{ name: string; error: string }>): string {
  const lines = [
    `Sommermodus-Wächter: ${result.checked} Thermostate geprüft, ${result.mismatched} Abweichungen erkannt.`,
    `${result.corrected} korrigiert, ${result.failed} fehlgeschlagen.`
  ];
  if (correctedNames.length) lines.push(`Korrigiert: ${correctedNames.join(", ")}`);
  if (failures.length) lines.push(`Fehler: ${failures.map(item => `${item.name} (${item.error})`).join(", ")}`);
  let message = lines.join("\n");
  if (message.length > 1000) message = `${message.slice(0, 997)}…`;
  return message;
}

export class ClimateModeManager {
  private guardTimer?: NodeJS.Timeout;
  private guardInitialTimer?: NodeJS.Timeout;
  private guardStarted = false;

  constructor(
    private readonly registry: ClimateRegistry,
    private readonly commander: Commander,
    private readonly pushoverSender: PushoverSender = sendPushoverMessage
  ) {}

  start(): void {
    if (this.guardStarted) return;
    this.guardStarted = true;
    this.guardTimer = setInterval(() => void this.verifySummerThermostats().catch(() => undefined), SUMMER_GUARD_INTERVAL_MS);
    this.guardTimer.unref();
    this.guardInitialTimer = setTimeout(() => void this.verifySummerThermostats().catch(() => undefined), SUMMER_GUARD_INITIAL_DELAY_MS);
    this.guardInitialTimer.unref();
  }

  stop(): void {
    if (!this.guardStarted) return;
    this.guardStarted = false;
    if (this.guardTimer) clearInterval(this.guardTimer);
    if (this.guardInitialTimer) clearTimeout(this.guardInitialTimer);
    this.guardTimer = undefined;
    this.guardInitialTimer = undefined;
  }

  private thermostatCounts(): { thermostats: number; supportedThermostats: number } {
    const thermostats = this.registry.all().filter(device => device.type === "thermostat");
    return {
      thermostats: thermostats.length,
      supportedThermostats: thermostats.filter(thermostatSupportsSystemMode).length
    };
  }

  async status(): Promise<ClimateModeStatus> {
    return { ...(await getClimateModeSettings()), ...this.thermostatCounts() };
  }

  private async syncAutomationDevice(state: DeviceState, stamp = new Date().toISOString()): Promise<void> {
    if (typeof this.registry.get !== "function" || typeof this.registry.set !== "function") return;
    const systemDevice = this.registry.get(CLIMATE_MODE_AUTOMATION_DEVICE_ID);
    if (!systemDevice) return;
    await this.registry.set({
      ...systemDevice,
      reachable: true,
      state: { ...systemDevice.state, ...state },
      lastSeen: stamp,
      lastEvent: stamp
    });
  }

  async setWinterMode(winterMode: WinterThermostatMode): Promise<ClimateModeStatus> {
    const settings = await updateClimateWinterMode(winterMode);
    await this.syncAutomationDevice({ winterMode: settings.winterMode });
    await writeSystemLog(
      "info",
      "system",
      "CLIMATE_WINTER_MODE_CONFIGURED",
      "Winter thermostat mode configuration updated",
      { winterMode }
    ).catch(() => undefined);
    return this.status();
  }

  async apply(mode: ClimateMode): Promise<ClimateModeStatus> {
    const current = await getClimateModeSettings();
    const winterMode = current.winterMode;
    const thermostats = this.registry.all().filter(thermostatSupportsSystemMode);
    const targetMode = mode === "summer" ? "off" : winterMode;
    let succeeded = 0;
    let failed = 0;
    const failures: Array<{ deviceId: string; name: string; error: string }> = [];

    for (const device of thermostats) {
      try {
        await this.commander.command({
          deviceId: device.id,
          capability: "setThermostatMode",
          value: targetMode,
          source: "system"
        });
        succeeded += 1;
      } catch (error) {
        failed += 1;
        failures.push({
          deviceId: device.id,
          name: device.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const appliedAt = new Date().toISOString();
    const lastResult = { total: thermostats.length, succeeded, failed };
    const settings = await updateClimateModeSettings({ mode, winterMode, lastAppliedAt: appliedAt, lastResult });
    await this.syncAutomationDevice({ mode: settings.mode, winterMode: settings.winterMode, winterActive: settings.mode === "winter" }, appliedAt);
    await writeSystemLog(
      failed ? "warning" : "info",
      "system",
      failed ? "CLIMATE_MODE_PARTIAL" : "CLIMATE_MODE_APPLIED",
      mode === "summer" ? "Summer mode applied to thermostats" : "Winter mode applied to thermostats",
      { mode, winterMode, targetMode, ...lastResult, failures }
    ).catch(() => undefined);
    return this.status();
  }

  async verifySummerThermostats(): Promise<SummerGuardResult> {
    const settings = await getClimateModeSettings();
    if (settings.mode !== "summer") return { mode: settings.mode, checked: 0, mismatched: 0, corrected: 0, failed: 0 };

    const thermostats = this.registry.all().filter(thermostatSupportsSystemMode);
    const mismatches = thermostats.filter(device => !thermostatIsOff(device));
    let corrected = 0;
    let failed = 0;
    const correctedNames: string[] = [];
    const failures: Array<{ deviceId: string; name: string; error: string }> = [];

    for (const device of mismatches) {
      try {
        await this.commander.command({
          deviceId: device.id,
          capability: "setThermostatMode",
          value: "off",
          source: "system"
        });
        corrected += 1;
        correctedNames.push(device.name);
      } catch (error) {
        failed += 1;
        failures.push({
          deviceId: device.id,
          name: device.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const result: SummerGuardResult = {
      mode: settings.mode,
      checked: thermostats.length,
      mismatched: mismatches.length,
      corrected,
      failed
    };

    if (mismatches.length) {
      await writeSystemLog(
        failed ? "warning" : "info",
        "system",
        failed ? "SUMMER_THERMOSTAT_GUARD_PARTIAL" : "SUMMER_THERMOSTAT_GUARD_CORRECTED",
        failed ? "Summer thermostat guard could not correct every thermostat" : "Summer thermostat guard corrected thermostat mode drift",
        { ...result, correctedNames, failures }
      ).catch(() => undefined);

      try {
        const [general, pushover] = await Promise.all([getGeneralSettings(), getPushoverConnection()]);
        const debugNotification = general.debugLevel === "verbose" || (general.debugLevel === "errors" && failed > 0);
        if (debugNotification && pushover.userKey && pushover.apiToken) {
          await this.pushoverSender({
            userKey: pushover.userKey,
            apiToken: pushover.apiToken,
            title: failed ? "SALTA DEBUG: Sommermodus Fehler" : "SALTA DEBUG: Sommermodus korrigiert",
            message: debugGuardMessage(result, correctedNames, failures)
          });
        }
      } catch (error) {
        await writeSystemLog("error", "notification", "PUSHOVER_DEBUG_SEND_FAILED", "Pushover debug notification could not be sent", {
          event: "summer-thermostat-guard",
          error: error instanceof Error ? error.message : String(error)
        }).catch(() => undefined);
      }
    }

    return result;
  }
}
