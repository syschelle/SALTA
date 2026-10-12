import { describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import { openCcuDeviceFromChannel, type OpenCcuCatalogEntry } from "./openccu-core.js";

const dbMocks = vi.hoisted(() => ({
  clearOpenCcuSettings: vi.fn(async () => undefined),
  getOpenCcuConnection: vi.fn(async () => ({ baseUrl: "http://openccu.local", username: "salta", password: "secret" })),
  updateOpenCcuSettings: vi.fn(async () => undefined),
  writeSystemLog: vi.fn(async () => undefined)
}));

vi.mock("./db.js", () => dbMocks);

import { OpenCcuAdapter } from "./openccu-adapter.js";

const entry: OpenCcuCatalogEntry = {
  interfaceName: "BidCos-RF",
  channelAddress: "MEQ0004123:2",
  channelType: "THERMALCONTROL_TRANSMIT",
  deviceAddress: "MEQ0004123",
  deviceName: "HM-WTH-ARBEITSZIMMER",
  model: "HM-TC-IT-WM-W-EU",
  firmwareVersion: "1.4",
  channelCount: 6,
  paramsetDescription: {
    SET_TEMPERATURE: { TYPE: "FLOAT", OPERATIONS: 7, MIN: 4.5, MAX: 30.5 },
    CONTROL_MODE: { TYPE: "ENUM", OPERATIONS: 5, MIN: 0, VALUE_LIST: "AUTO MANU PARTY BOOST" }
  }
};

function thermostat(values: Record<string, unknown>): Device {
  const device = openCcuDeviceFromChannel({ ...entry, baseUrl: "http://openccu.local", values });
  if (!device || device.type !== "thermostat") throw new Error("fixture did not map to thermostat");
  return device;
}

function registryFor(initial: Device): DeviceRegistry {
  return {
    all: () => [initial],
    get: (id: string) => id === initial.id ? initial : undefined,
    set: vi.fn(async () => undefined),
    restore: vi.fn(),
    removeSource: vi.fn()
  } as unknown as DeviceRegistry;
}

describe("v0.8.119 thermostat adapter path retirement", () => {
  it("rejects direct target-temperature execution in the generic OpenCCU adapter", async () => {
    const device = thermostat({ ACTUAL_TEMPERATURE: 22.2, SET_TEMPERATURE: 4.5, CONTROL_MODE: 1 });
    const adapter = new OpenCcuAdapter(registryFor(device));

    await expect(adapter.command({
      deviceId: device.id,
      capability: "setTargetTemperature",
      value: 15,
      source: "automation"
    })).rejects.toThrow("THERMOSTAT_CONTROL_ROUTED_EXTERNALLY");
  });

  it("rejects direct thermostat-mode execution in the generic OpenCCU adapter", async () => {
    const device = thermostat({ ACTUAL_TEMPERATURE: 22.2, SET_TEMPERATURE: 20, CONTROL_MODE: 1 });
    const adapter = new OpenCcuAdapter(registryFor(device));

    await expect(adapter.command({
      deviceId: device.id,
      capability: "setThermostatMode",
      value: "manual",
      source: "api"
    })).rejects.toThrow("THERMOSTAT_CONTROL_ROUTED_EXTERNALLY");
  });

  it("does not consult climate policy before rejecting the legacy path", async () => {
    const device = thermostat({ ACTUAL_TEMPERATURE: 22.2, SET_TEMPERATURE: 4.5, CONTROL_MODE: 1 });
    const adapter = new OpenCcuAdapter(registryFor(device));

    await expect(adapter.command({
      deviceId: device.id,
      capability: "setTargetTemperature",
      value: 17,
      source: "automation"
    })).rejects.toThrow("THERMOSTAT_CONTROL_ROUTED_EXTERNALLY");
    expect(dbMocks.getOpenCcuConnection).not.toHaveBeenCalled();
  });
});