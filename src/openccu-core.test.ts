import { describe, expect, it } from "vitest";
import {
  interfaceNames,
  normalizeOpenCcuBaseUrl,
  openCcuCatalogFromDescriptions,
  openCcuDeviceFromChannel,
  openCcuRpcEndpoint,
  stringifyRpcParams,
  unwrapRpcResult
} from "./openccu-core.js";

describe("OpenCCU JSON-RPC core", () => {
  it("normalizes a local OpenCCU address and builds the JSON-RPC endpoint", () => {
    expect(normalizeOpenCcuBaseUrl("192.168.178.30")).toBe("http://192.168.178.30");
    expect(normalizeOpenCcuBaseUrl("https://openccu.local/")).toBe("https://openccu.local");
    expect(openCcuRpcEndpoint("http://openccu.local")).toBe("http://openccu.local/api/homematic.cgi");
    expect(() => normalizeOpenCcuBaseUrl("ftp://openccu.local")).toThrow("OPENCCU_URL_INVALID");
    expect(() => normalizeOpenCcuBaseUrl("http://openccu.local/path")).toThrow("OPENCCU_URL_INVALID");
  });

  it("serializes JSON-RPC parameters using the string values expected by OpenCCU", () => {
    expect(stringifyRpcParams({ enabled: true, level: 0.5, empty: null })).toEqual({
      enabled: "true",
      level: "0.5",
      empty: ""
    });
    expect(unwrapRpcResult({ result: ["HmIP-RF"], error: null })).toEqual(["HmIP-RF"]);
    expect(() => unwrapRpcResult({ error: { code: -1, message: "invalid session" } })).toThrow("OPENCCU_API_ERROR");
    expect(() => unwrapRpcResult({ error: "access denied" })).toThrow("OPENCCU_API_ERROR");
  });

  it("accepts interface descriptions with upper- or lower-case property names", () => {
    expect(interfaceNames(["BidCos-RF", { NAME: "HmIP-RF" }, { name: "VirtualDevices" }])).toEqual([
      "BidCos-RF",
      "HmIP-RF",
      "VirtualDevices"
    ]);

    const catalog = openCcuCatalogFromDescriptions("HmIP-RF", [
      { ADDRESS: "0011223344", TYPE: "HmIP-BSM", FIRMWARE: "1.2.3", CHILDREN: ["0011223344:0", "0011223344:4"] },
      { ADDRESS: "0011223344:0", PARENT: "0011223344", TYPE: "MAINTENANCE", PARAMSETS: ["VALUES"] },
      { ADDRESS: "0011223344:4", PARENT: "0011223344", TYPE: "SWITCH_VIRTUAL_RECEIVER", PARAMSETS: ["VALUES"] }
    ], [
      { address: "0011223344", name: "Flurlicht%20West", channels: [{ address: "0011223344:4", channelName: "Flurlicht%20Schalter" }] }
    ]);

    expect(catalog).toEqual([expect.objectContaining({
      interfaceName: "HmIP-RF",
      channelAddress: "0011223344:4",
      deviceAddress: "0011223344",
      deviceName: "Flurlicht West",
      channelName: "Flurlicht Schalter",
      model: "HmIP-BSM",
      firmwareVersion: "1.2.3"
    })]);
  });
});

describe("OpenCCU HomeMatic device mapping", () => {
  const base = {
    baseUrl: "http://openccu.local",
    interfaceName: "HmIP-RF",
    deviceAddress: "0011223344",
    deviceName: "Testgerät",
    model: "HmIP-Test",
    firmwareVersion: "1.0.0",
    channelCount: 4
  };

  it("maps a switch channel with command metadata", () => {
    const device = openCcuDeviceFromChannel({
      ...base,
      channelAddress: "0011223344:4",
      channelType: "SWITCH_VIRTUAL_RECEIVER",
      values: { STATE: true, UNREACH: false }
    });
    expect(device).toMatchObject({
      id: "openccu:HmIP-RF:0011223344_3A4",
      source: "openccu",
      type: "switch",
      state: { on: true },
      capabilities: ["turnOn", "turnOff", "toggle"],
      homekitEnabled: false,
      adapterData: { interfaceName: "HmIP-RF", channelAddress: "0011223344:4", stateParameter: "STATE" }
    });
  });

  it("maps dimmers and covers with level controls", () => {
    const light = openCcuDeviceFromChannel({
      ...base,
      channelAddress: "0011223344:5",
      channelType: "DIMMER_VIRTUAL_RECEIVER",
      values: { LEVEL: 0.42, STATE: true }
    });
    expect(light).toMatchObject({ type: "light", state: { on: true, brightness: 42 } });
    expect(light?.capabilities).toContain("setBrightness");

    const cover = openCcuDeviceFromChannel({
      ...base,
      channelAddress: "0011223344:6",
      channelType: "BLIND_VIRTUAL_RECEIVER",
      values: { LEVEL: 0.75, STOP: false, ACTIVITY_STATE: "STABLE" }
    });
    expect(cover).toMatchObject({ type: "windowCovering", state: { currentPosition: 75, targetPosition: 75 } });
    expect(cover?.capabilities).toEqual(["open", "close", "stop", "setTargetPosition"]);
  });

  it("maps smoke alarms and ignores the counter overflow flag as energy", () => {
    const sensor = openCcuDeviceFromChannel({
      ...base,
      channelAddress: "0011223344:2",
      channelType: "SMOKE_DETECTOR",
      values: { SMOKE_DETECTOR_ALARM_STATUS: "PRIMARY_ALARM", ENERGY_COUNTER_OVERFLOW: true }
    });
    expect(sensor).toMatchObject({ type: "smokeSensor", state: { fire: true } });
    expect(sensor?.state.energy).toBeUndefined();
  });

  it("maps common read-only sensor values", () => {
    const sensor = openCcuDeviceFromChannel({
      ...base,
      channelAddress: "0011223344:1",
      channelType: "WEATHER_TRANSMIT",
      values: { ACTUAL_TEMPERATURE: 21.4, HUMIDITY: 47, LOW_BAT: false }
    });
    expect(sensor).toMatchObject({
      type: "temperatureSensor",
      state: { temperature: 21.4, humidity: 47, lowBattery: false },
      capabilities: []
    });
  });
});
