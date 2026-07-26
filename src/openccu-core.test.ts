import { describe, expect, it } from "vitest";
import {
  interfaceNames,
  normalizeOpenCcuBaseUrl,
  openCcuCatalogFromDescriptions,
  openCcuDeviceFromChannel,
  openCcuDeviceIds,
  openCcuObjectName,
  openCcuRpcEndpoint,
  reconciledOpenCcuName,
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

  it("reads unique ReGa device ids for Device.get", () => {
    expect(openCcuDeviceIds([12, "13", { ID: "14" }, { deviceId: 12 }])).toEqual(["12", "13", "14"]);
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


  it("reads OpenCCU device and channel names from keyed detail payloads", () => {
    const catalog = openCcuCatalogFromDescriptions("BidCos-RF", [
      { ADDRESS: "NEQ1157537", TYPE: "HM-Sec-SCo", CHILDREN: ["NEQ1157537:0", "NEQ1157537:1"] },
      { ADDRESS: "NEQ1157537:1", PARENT: "NEQ1157537", TYPE: "SHUTTER_CONTACT", PARAMSETS: ["VALUES"] }
    ], {
      NEQ1157537: {
        address: "NEQ1157537",
        name: "Fensterkontakt+Wohnzimmer",
        channels: [{ address: "NEQ1157537:1", name: "Fensterkontakt+Wohnzimmer:1" }]
      }
    });

    expect(catalog).toEqual([expect.objectContaining({
      deviceName: "Fensterkontakt Wohnzimmer",
      channelName: "Fensterkontakt Wohnzimmer:1"
    })]);
  });

  it("derives device names from generated channel names when OpenCCU omits the device address", () => {
    const catalog = openCcuCatalogFromDescriptions("BidCos-RF", [
      { ADDRESS: "LEQ0422906", TYPE: "HM-CC-RT-DN", CHILDREN: ["LEQ0422906:0", "LEQ0422906:4"] },
      { ADDRESS: "LEQ0422906:4", PARENT: "LEQ0422906", TYPE: "THERMAL_CONTROL_TRANSMIT", PARAMSETS: ["VALUES"] }
    ], [
      {
        id: "1234",
        channels: [
          { address: "LEQ0422906:4", name: "Heizung+Wohnzimmer:4" }
        ]
      }
    ]);

    expect(catalog).toEqual([expect.objectContaining({
      deviceName: "Heizung Wohnzimmer",
      channelName: "Heizung Wohnzimmer:4"
    })]);

    const device = openCcuDeviceFromChannel({
      ...catalog[0]!,
      baseUrl: "http://openccu.local",
      values: { ACTUAL_TEMPERATURE: 21.5, OPERATING_VOLTAGE: 2.5 }
    });
    expect(device?.name).toBe("Heizung Wohnzimmer");
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


  it("replaces legacy generated names while preserving local SALTA names", () => {
    const discovered = openCcuDeviceFromChannel({
      ...base,
      deviceAddress: "NEQ1157537",
      deviceName: "Fensterkontakt Wohnzimmer",
      model: "HM-Sec-SCo",
      channelAddress: "NEQ1157537:1",
      channelType: "SHUTTER_CONTACT",
      values: { STATE: false }
    });
    expect(discovered).toBeDefined();
    const legacy = { ...discovered!, name: "HM-Sec-SCo NEQ1157537:1", adapterData: {
      interfaceName: "BidCos-RF",
      channelAddress: "NEQ1157537:1",
      channelType: "SHUTTER_CONTACT"
    } };
    expect(reconciledOpenCcuName(legacy, discovered!)).toBe("Fensterkontakt Wohnzimmer");

    const sourceManaged = { ...discovered!, name: "Alter CCU-Name", adapterData: {
      ...discovered!.adapterData,
      sourceName: "Alter CCU-Name"
    } };
    expect(reconciledOpenCcuName(sourceManaged, discovered!)).toBe("Fensterkontakt Wohnzimmer");

    const locallyRenamed = { ...sourceManaged, name: "Terrassentür" };
    expect(reconciledOpenCcuName(locallyRenamed, discovered!)).toBe("Terrassentür");
  });


  it("reads the physical device name and prefers it over a channel label", () => {
    expect(openCcuObjectName({ address: "NEQ1157537", name: "Fensterkontakt+Wohnzimmer" })).toBe("Fensterkontakt Wohnzimmer");

    const device = openCcuDeviceFromChannel({
      ...base,
      deviceName: "Heizung Wohnzimmer",
      channelName: "Heizung Wohnzimmer:4",
      channelAddress: "0011223344:4",
      channelType: "CLIMATECONTROL_REGULATOR",
      values: { ACTUAL_TEMPERATURE: 21.2, SET_TEMPERATURE: 22.5 }
    });
    expect(device?.name).toBe("Heizung Wohnzimmer");
  });

  it("maps writable thermostat setpoints with native RPC metadata", () => {
    const device = openCcuDeviceFromChannel({
      ...base,
      channelAddress: "0011223344:4",
      channelType: "CLIMATECONTROL_REGULATOR",
      paramsetDescription: {
        SET_TEMPERATURE: { TYPE: "FLOAT", OPERATIONS: 7, MIN: 4.5, MAX: 30.5 }
      },
      values: { ACTUAL_TEMPERATURE: 21.2, SET_TEMPERATURE: 22.5, VALVE_STATE: 34 }
    });
    expect(device).toMatchObject({
      type: "thermostat",
      state: { temperature: 21.2, targetTemperature: 22.5, valvePosition: 34 },
      capabilities: ["setTargetTemperature"],
      adapterData: {
        targetTemperatureParameter: "SET_TEMPERATURE",
        targetTemperatureValueType: "float",
        targetTemperatureMin: 4.5,
        targetTemperatureMax: 30.5
      }
    });
  });

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
      adapterData: { interfaceName: "HmIP-RF", channelAddress: "0011223344:4", stateParameter: "STATE", stateValueType: "bool" }
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
