import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "./types.js";
import type { DeviceRegistry } from "./registry.js";
import { openCcuDeviceFromChannel, type OpenCcuCatalogEntry } from "./openccu-core.js";

const dbMocks = vi.hoisted(() => ({
  clearOpenCcuSettings: vi.fn(async () => undefined),
  getClimateModeSettings: vi.fn(async () => ({ mode: "winter", winterMode: "manual" })),
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

function registryFor(initial: Device): { registry: DeviceRegistry; current: () => Device } {
  let current = initial;
  const registry = {
    all: () => [current],
    get: (id: string) => id === current.id ? current : undefined,
    set: vi.fn(async (device: Device) => { current = device; }),
    restore: vi.fn(),
    removeSource: vi.fn()
  } as unknown as DeviceRegistry;
  return { registry, current: () => current };
}

function rpcResult(id: number, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "1.1", id, result }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function rpcHarness(preflight: Record<string, unknown>, readback: Record<string, unknown>) {
  const requests: Array<{ method: string; params: Record<string, unknown> }> = [];
  let paramsetReads = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { id: number; method: string; params: Record<string, unknown> };
    requests.push({ method: body.method, params: body.params });
    if (body.method === "Session.login") return rpcResult(body.id, "session-id");
    if (body.method === "Interface.getParamset") {
      paramsetReads += 1;
      return rpcResult(body.id, paramsetReads === 1 ? preflight : readback);
    }
    if (body.method === "Interface.setValue") return rpcResult(body.id, true);
    throw new Error(`Unexpected method ${body.method}`);
  }));
  return { requests, readCount: () => paramsetReads };
}

function setValueRequests(requests: Array<{ method: string; params: Record<string, unknown> }>) {
  return requests
    .filter(request => request.method === "Interface.setValue")
    .map(request => ({ valueKey: request.params.valueKey, value: request.params.value }));
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.getClimateModeSettings.mockResolvedValue({ mode: "winter", winterMode: "manual" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("v0.8.119 live OpenCCU thermostat target flow", () => {
  it("reads OFF from OpenCCU, restores MANUAL in Winter, then writes the requested temperature and verifies it", async () => {
    const before = {
      ACTUAL_TEMPERATURE: 22.2,
      SET_TEMPERATURE: 4.5,
      CONTROL_MODE: 1
    };
    const after = {
      ACTUAL_TEMPERATURE: 22.2,
      SET_TEMPERATURE: 15,
      CONTROL_MODE: 1
    };
    const initial = thermostat(before);
    expect(initial.state).toMatchObject({ controlMode: "off", targetTemperature: 4.5 });
    const { registry, current } = registryFor(initial);
    const { requests, readCount } = rpcHarness(before, after);
    const adapter = new OpenCcuAdapter(registry);
    (adapter as unknown as { catalog: OpenCcuCatalogEntry[] }).catalog = [entry];

    const result = await adapter.command({
      deviceId: initial.id,
      capability: "setTargetTemperature",
      value: 15,
      source: "automation"
    });

    expect(readCount()).toBe(2);
    expect(setValueRequests(requests)).toEqual([
      { valueKey: "MANU_MODE", value: "15" },
      { valueKey: "SET_TEMPERATURE", value: "15" }
    ]);
    expect(result.state).toMatchObject({ controlMode: "manual", targetTemperature: 15 });
    expect(current().state).toMatchObject({ controlMode: "manual", targetTemperature: 15 });
    expect(dbMocks.writeSystemLog).toHaveBeenCalledWith(
      "info",
      "openccu",
      "OPENCCU_COMMAND_APPLIED",
      "OpenCCU thermostat target command applied and verified",
      expect.objectContaining({
        verified: true,
        winterManualRecovery: true,
        climateMode: "winter",
        liveStateBeforeCommand: expect.objectContaining({ controlMode: "off", targetTemperature: 4.5 }),
        readbackStateAfterCommand: expect.objectContaining({ controlMode: "manual", targetTemperature: 15 })
      })
    );
  });

  it("uses only SET_TEMPERATURE when the fresh OpenCCU state is already MANUAL", async () => {
    const before = {
      ACTUAL_TEMPERATURE: 22.2,
      SET_TEMPERATURE: 20,
      CONTROL_MODE: 1
    };
    const after = {
      ACTUAL_TEMPERATURE: 22.2,
      SET_TEMPERATURE: 15,
      CONTROL_MODE: 1
    };
    const initial = thermostat(before);
    expect(initial.state).toMatchObject({ controlMode: "manual", targetTemperature: 20 });
    const { registry } = registryFor(initial);
    const { requests, readCount } = rpcHarness(before, after);
    const adapter = new OpenCcuAdapter(registry);
    (adapter as unknown as { catalog: OpenCcuCatalogEntry[] }).catalog = [entry];

    const result = await adapter.command({
      deviceId: initial.id,
      capability: "setTargetTemperature",
      value: 15,
      source: "automation"
    });

    expect(readCount()).toBe(2);
    expect(setValueRequests(requests)).toEqual([
      { valueKey: "SET_TEMPERATURE", value: "15" }
    ]);
    expect(result.state).toMatchObject({ controlMode: "manual", targetTemperature: 15 });
  });

  it("does not perform the Winter OFF-to-MANUAL recovery while SALTA is in Summer mode", async () => {
    dbMocks.getClimateModeSettings.mockResolvedValue({ mode: "summer", winterMode: "manual" });
    const before = {
      ACTUAL_TEMPERATURE: 22.2,
      SET_TEMPERATURE: 4.5,
      CONTROL_MODE: 1
    };
    const after = {
      ACTUAL_TEMPERATURE: 22.2,
      SET_TEMPERATURE: 15,
      CONTROL_MODE: 1
    };
    const initial = thermostat(before);
    const { registry } = registryFor(initial);
    const { requests } = rpcHarness(before, after);
    const adapter = new OpenCcuAdapter(registry);
    (adapter as unknown as { catalog: OpenCcuCatalogEntry[] }).catalog = [entry];

    await adapter.command({
      deviceId: initial.id,
      capability: "setTargetTemperature",
      value: 15,
      source: "automation"
    });

    expect(setValueRequests(requests)).toEqual([
      { valueKey: "SET_TEMPERATURE", value: "15" }
    ]);
  });
});
