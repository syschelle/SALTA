import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import type { OpenCcuControlTransport } from "./openccu-control-client.js";
import { openCcuDeviceFromChannel, type OpenCcuCatalogEntry } from "./openccu-core.js";

const dbMocks = vi.hoisted(() => ({
  getOpenCcuConnection: vi.fn(async () => ({ baseUrl: "http://openccu.local", username: "salta", password: "secret" })),
  writeSystemLog: vi.fn(async () => undefined)
}));

vi.mock("./db.js", () => dbMocks);

import { OpenCcuThermostatController } from "./openccu-thermostat-controller.js";

const entry: OpenCcuCatalogEntry = {
  interfaceName: "BidCos-RF",
  channelAddress: "MEQ0004123:2",
  channelType: "THERMALCONTROL_TRANSMIT",
  deviceAddress: "MEQ0004123",
  deviceName: "HM-WTH-ARBEITSZIMMER",
  channelName: "HM-TC-IT-WM-W-EU MEQ0004123:2",
  model: "HM-TC-IT-WM-W-EU",
  firmwareVersion: "1.4",
  channelCount: 6,
  paramsetDescription: {
    SET_TEMPERATURE: { TYPE: "FLOAT", OPERATIONS: 7, MIN: 4.5, MAX: 30 },
    CONTROL_MODE: { TYPE: "ENUM", OPERATIONS: 5, MIN: 0, VALUE_LIST: "AUTO MANU PARTY BOOST" },
    AUTO_MODE: { TYPE: "ACTION", OPERATIONS: 2 },
    MANU_MODE: { TYPE: "ACTION", OPERATIONS: 2 }
  }
};

function thermostat(values: Record<string, unknown>): Device {
  const device = openCcuDeviceFromChannel({ ...entry, baseUrl: "http://openccu.local", values });
  if (!device || device.type !== "thermostat") throw new Error("fixture did not map to thermostat");
  return device;
}

function registryFor(initial: Device): { registry: DeviceRegistry; current: () => Device } {
  let current = initial;
  const registry = {
    get: (id: string) => id === current.id ? current : undefined,
    set: vi.fn(async (device: Device) => { current = device; })
  } as unknown as DeviceRegistry;
  return { registry, current: () => current };
}

function transportFor(before: Record<string, unknown>, after: Record<string, unknown>) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  let reads = 0;
  const transport: OpenCcuControlTransport = {
    call: vi.fn(async (_connection, method, params = {}) => {
      calls.push({ method, params });
      if (method === "Interface.getParamset") {
        reads += 1;
        return reads === 1 ? before : after;
      }
      if (method === "Interface.setValue") return true;
      throw new Error(`Unexpected method ${method}`);
    })
  };
  return { transport, calls, reads: () => reads };
}

function writes(calls: Array<{ method: string; params: Record<string, unknown> }>) {
  return calls
    .filter(call => call.method === "Interface.setValue")
    .map(call => ({ valueKey: call.params.valueKey, value: call.params.value }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("v0.8.120 isolated OpenCCU thermostat controller", () => {
  it("uses the workflow-provided temperature directly and leaves classic BidCos OFF with one MANU_MODE write", async () => {
    const before = { ACTUAL_TEMPERATURE: 22.2, SET_TEMPERATURE: 4.5, CONTROL_MODE: 1 };
    const after = { ACTUAL_TEMPERATURE: 22.2, SET_TEMPERATURE: 17.5, CONTROL_MODE: 1 };
    const initial = thermostat(before);
    const { registry, current } = registryFor(initial);
    const { transport, calls, reads } = transportFor(before, after);
    const controller = new OpenCcuThermostatController(registry, transport);

    const result = await controller.command({
      deviceId: initial.id,
      capability: "setTargetTemperature",
      value: 17.5,
      source: "automation"
    });

    expect(reads()).toBe(2);
    expect(writes(calls)).toEqual([{ valueKey: "MANU_MODE", value: 17.5 }]);
    expect(result.state).toMatchObject({ controlMode: "manual", targetTemperature: 17.5 });
    expect(current().state).toMatchObject({ controlMode: "manual", targetTemperature: 17.5 });
    expect(dbMocks.writeSystemLog).toHaveBeenCalledWith(
      "info",
      "openccu",
      "OPENCCU_COMMAND_APPLIED",
      "OpenCCU thermostat command applied and verified",
      expect.objectContaining({
        commandSource: "automation",
        requestedValue: 17.5,
        verified: true,
        writes: [expect.objectContaining({ valueKey: "MANU_MODE", value: 17.5 })]
      })
    );
  });

  it("changes only SET_TEMPERATURE when the selected thermostat is already manual", async () => {
    const before = { ACTUAL_TEMPERATURE: 21, SET_TEMPERATURE: 20, CONTROL_MODE: 1 };
    const after = { ACTUAL_TEMPERATURE: 21, SET_TEMPERATURE: 14, CONTROL_MODE: 1 };
    const initial = thermostat(before);
    const { registry } = registryFor(initial);
    const { transport, calls } = transportFor(before, after);
    const controller = new OpenCcuThermostatController(registry, transport);

    await controller.command({
      deviceId: initial.id,
      capability: "setTargetTemperature",
      value: 14,
      source: "automation"
    });

    expect(writes(calls)).toEqual([{ valueKey: "SET_TEMPERATURE", value: 14 }]);
  });

  it("has no global Summer/Winter policy dependency in a target-temperature command", async () => {
    const before = { ACTUAL_TEMPERATURE: 20, SET_TEMPERATURE: 4.5, CONTROL_MODE: 1 };
    const after = { ACTUAL_TEMPERATURE: 20, SET_TEMPERATURE: 16, CONTROL_MODE: 1 };
    const initial = thermostat(before);
    const { registry } = registryFor(initial);
    const { transport, calls } = transportFor(before, after);
    const controller = new OpenCcuThermostatController(registry, transport);

    await controller.command({
      deviceId: initial.id,
      capability: "setTargetTemperature",
      value: 16,
      source: "api"
    });

    expect(writes(calls)).toEqual([{ valueKey: "MANU_MODE", value: 16 }]);
    expect(dbMocks.getOpenCcuConnection).toHaveBeenCalledTimes(1);
  });
});
