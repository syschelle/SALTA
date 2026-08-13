import type { ClimateMode, ClimateModeSettings, Device, DeviceCommand, WinterThermostatMode } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import { getClimateModeSettings, updateClimateModeSettings, updateClimateWinterMode, writeSystemLog } from "./db.js";

export interface ClimateModeStatus extends ClimateModeSettings {
  thermostats: number;
  supportedThermostats: number;
}

type Commander = { command(command: DeviceCommand): Promise<Device> };

export function thermostatSupportsSystemMode(device: Device): boolean {
  if (device.type !== "thermostat") return false;
  if (device.capabilities.includes("setThermostatMode")) return true;
  return device.source === "openccu"
    && device.capabilities.includes("setTargetTemperature")
    && typeof device.state.controlMode === "string";
}

export class ClimateModeManager {
  constructor(
    private readonly registry: DeviceRegistry,
    private readonly commander: Commander
  ) {}

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

  async setWinterMode(winterMode: WinterThermostatMode): Promise<ClimateModeStatus> {
    await updateClimateWinterMode(winterMode);
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
    await updateClimateModeSettings({ mode, winterMode, lastAppliedAt: appliedAt, lastResult });
    await writeSystemLog(
      failed ? "warning" : "info",
      "system",
      failed ? "CLIMATE_MODE_PARTIAL" : "CLIMATE_MODE_APPLIED",
      mode === "summer" ? "Summer mode applied to thermostats" : "Winter mode applied to thermostats",
      { mode, winterMode, targetMode, ...lastResult, failures }
    ).catch(() => undefined);
    return this.status();
  }
}
