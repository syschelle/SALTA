import type { ClimateMode, ClimateModeSettings, Device, DeviceCommand, DeviceState, WinterThermostatMode } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import { CLIMATE_MODE_AUTOMATION_DEVICE_ID } from "./automations.js";
import { getClimateModeSettings, getGeneralSettings, getPushoverConnection, updateClimateModeSettings, updateClimateWinterMode, writeSystemLog } from "./db.js";
import { sendPushoverMessage, type PushoverSender } from "./pushover.js";

export const CLIMATE_GUARD_INTERVAL_MS = 60 * 60 * 1000;
const CLIMATE_GUARD_INITIAL_DELAY_MS = 2 * 60 * 1000;

export interface ClimateModeStatus extends ClimateModeSettings {
  thermostats: number;
  supportedThermostats: number;
}

export interface ClimateGuardResult {
  mode: ClimateMode;
  targetMode: "off" | "manual";
  checked: number;
  mismatched: number;
  corrected: number;
  failed: number;
}

type Commander = { command(command: DeviceCommand): Promise<Device> };
type ClimateRegistry = Pick<DeviceRegistry, "all"> & Partial<Pick<DeviceRegistry, "get" | "set">>;

type GuardThermostatMode = "off" | "manual" | "auto" | "boost" | "party" | "away";

function isOpenCcuVirtualThermostat(device: Device): boolean {
  return device.source === "openccu"
    && String(device.adapterData?.interfaceName ?? "").trim().toLowerCase() === "virtualdevices";
}

export function thermostatSupportsSystemMode(device: Device): boolean {
  if (device.type !== "thermostat") return false;
  // OpenCCU VirtualDevices can mirror a heating group that already contains the
  // physical thermostats. Controlling both would duplicate HomeMatic radio traffic.
  if (isOpenCcuVirtualThermostat(device)) return false;
  if (device.capabilities.includes("setThermostatMode")) return true;
  return device.source === "openccu"
    && device.capabilities.includes("setTargetTemperature")
    && typeof device.state.controlMode === "string";
}

function currentGuardMode(device: Device): GuardThermostatMode | undefined {
  const mode = String(device.state.controlMode ?? "").trim().toLowerCase();
  return (["off", "manual", "auto", "boost", "party", "away"] as const).includes(mode as GuardThermostatMode)
    ? mode as GuardThermostatMode
    : undefined;
}

function thermostatHasMode(device: Device, targetMode: "off" | "manual"): boolean {
  return currentGuardMode(device) === targetMode;
}

function guardNeedsCorrection(device: Device, mode: ClimateMode): boolean {
  const current = currentGuardMode(device);
  if (!current) return false;
  // Winter guard is deliberately conservative: only an accidental AUTO mode is
  // corrected. OFF/boost/party/away are left untouched until Winter is explicitly
  // applied again by the user or an automation.
  if (mode === "winter") return current === "auto";
  // Summer policy remains OFF. Only known non-OFF states are corrected; unknown
  // states are ignored to avoid repeated radio traffic caused by ambiguous data.
  return current !== "off";
}

function debugGuardMessage(result: ClimateGuardResult, correctedNames: string[], failures: Array<{ name: string; error: string }>): string {
  const targetLabel = result.targetMode === "manual" ? "Handbetrieb" : "Aus";
  const lines = [
    `Heizmodus-Wächter (${result.mode === "winter" ? "Winter" : "Sommer"} → ${targetLabel}): ${result.checked} Thermostate geprüft, ${result.mismatched} Abweichungen erkannt.`,
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
    this.guardTimer = setInterval(() => void this.verifyThermostats().catch(() => undefined), CLIMATE_GUARD_INTERVAL_MS);
    this.guardTimer.unref();
    this.guardInitialTimer = setTimeout(() => void this.verifyThermostats().catch(() => undefined), CLIMATE_GUARD_INITIAL_DELAY_MS);
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
    if (winterMode !== "manual") throw new Error("AUTOMATIC_THERMOSTAT_MODE_DISABLED");
    const settings = await updateClimateWinterMode("manual");
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
    const winterMode: WinterThermostatMode = "manual";
    const thermostats = this.registry.all().filter(thermostatSupportsSystemMode);
    const targetMode: "off" | "manual" = mode === "summer" ? "off" : "manual";
    const targets = thermostats.filter(device => !thermostatHasMode(device, targetMode));
    let succeeded = 0;
    let failed = 0;
    const failures: Array<{ deviceId: string; name: string; error: string }> = [];

    for (const device of targets) {
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
    const lastResult = { total: targets.length, succeeded, failed };
    const settings = await updateClimateModeSettings({ mode, winterMode, lastAppliedAt: appliedAt, lastResult });
    await this.syncAutomationDevice({ mode: settings.mode, winterMode: settings.winterMode, winterActive: settings.mode === "winter", on: settings.mode === "winter" }, appliedAt);
    await writeSystemLog(
      failed ? "warning" : "info",
      "system",
      failed ? "CLIMATE_MODE_PARTIAL" : "CLIMATE_MODE_APPLIED",
      mode === "summer" ? "Summer mode applied to thermostats" : "Winter mode applied to thermostats",
      {
        mode,
        winterMode,
        targetMode,
        eligible: thermostats.length,
        alreadyCorrect: thermostats.length - targets.length,
        ...lastResult,
        failures
      }
    ).catch(() => undefined);
    return this.status();
  }

  async verifyThermostats(): Promise<ClimateGuardResult> {
    const settings = await getClimateModeSettings();
    const targetMode: "off" | "manual" = settings.mode === "summer" ? "off" : "manual";
    const thermostats = this.registry.all().filter(thermostatSupportsSystemMode);
    const mismatches = thermostats.filter(device => guardNeedsCorrection(device, settings.mode));
    let corrected = 0;
    let failed = 0;
    const correctedNames: string[] = [];
    const failures: Array<{ deviceId: string; name: string; error: string }> = [];

    for (const device of mismatches) {
      try {
        await this.commander.command({
          deviceId: device.id,
          capability: "setThermostatMode",
          value: targetMode,
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

    const result: ClimateGuardResult = {
      mode: settings.mode,
      targetMode,
      checked: thermostats.length,
      mismatched: mismatches.length,
      corrected,
      failed
    };

    if (mismatches.length) {
      await writeSystemLog(
        failed ? "warning" : "info",
        "system",
        failed ? "CLIMATE_THERMOSTAT_GUARD_PARTIAL" : "CLIMATE_THERMOSTAT_GUARD_CORRECTED",
        failed ? "Climate thermostat guard could not correct every thermostat" : "Climate thermostat guard corrected thermostat mode drift",
        { ...result, correctedNames, failures }
      ).catch(() => undefined);

      try {
        const [general, pushover] = await Promise.all([getGeneralSettings(), getPushoverConnection()]);
        const debugNotification = general.debugLevel === "verbose" || (general.debugLevel === "errors" && failed > 0);
        if (debugNotification && pushover.userKey && pushover.apiToken) {
          await this.pushoverSender({
            userKey: pushover.userKey,
            apiToken: pushover.apiToken,
            title: failed ? "SALTA DEBUG: Heizmodus Fehler" : "SALTA DEBUG: Heizmodus korrigiert",
            message: debugGuardMessage(result, correctedNames, failures)
          });
        }
      } catch (error) {
        await writeSystemLog("error", "notification", "PUSHOVER_DEBUG_SEND_FAILED", "Pushover debug notification could not be sent", {
          event: "climate-thermostat-guard",
          error: error instanceof Error ? error.message : String(error)
        }).catch(() => undefined);
      }
    }

    return result;
  }
}
