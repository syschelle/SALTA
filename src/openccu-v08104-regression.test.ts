import { describe, expect, it } from "vitest";
import { openCcuDeviceFromChannel, openCcuThermostatModePlan } from "./openccu-core.js";

describe("v0.8.104 HmIP thermostat mode synchronization", () => {
  it("reads established HmIP status from SET_POINT_MODE and commands CONTROL_MODE", () => {
    const device = openCcuDeviceFromChannel({
      baseUrl: "http://openccu.local",
      interfaceName: "HmIP-RF",
      channelAddress: "0011223344:1",
      channelType: "HEATING_CLIMATECONTROL_TRANSCEIVER",
      deviceAddress: "0011223344",
      model: "HmIP-WTH-2",
      paramsetDescription: {
        SET_POINT_TEMPERATURE: { TYPE: "FLOAT", OPERATIONS: 7, MIN: 4.5, MAX: 30.5 },
        SET_POINT_MODE: { TYPE: "ENUM", OPERATIONS: 5, MIN: 0, VALUE_LIST: "AUTOMATIC MANUAL AWAY" },
        CONTROL_MODE: { TYPE: "ENUM", OPERATIONS: 2, MIN: 0, VALUE_LIST: "AUTOMATIC MANUAL AWAY" }
      },
      values: {
        ACTUAL_TEMPERATURE: 20.8,
        SET_POINT_TEMPERATURE: 20,
        SET_POINT_MODE: 1,
        CONTROL_MODE: 0
      }
    });

    expect(device).toMatchObject({
      type: "thermostat",
      state: { targetTemperature: 20, controlMode: "manual" },
      adapterData: { modeParameter: "CONTROL_MODE", modeAutoValue: 0, modeManualValue: 1 }
    });
  });

  it("repairs persisted pre-v0.8.104 metadata and preserves a 20 degree manual target", () => {
    const plan = openCcuThermostatModePlan({
      interfaceName: "HmIP-RF",
      model: "HmIP-WTH-2",
      channelType: "HEATING_CLIMATECONTROL_TRANSCEIVER",
      targetTemperatureParameter: "SET_POINT_TEMPERATURE",
      targetTemperatureValueType: "float",
      targetTemperatureMin: 4.5,
      targetTemperatureMax: 30.5,
      thermostatOffTemperature: 4.5,
      modeParameter: "SET_POINT_MODE",
      modeValueType: "int",
      modeAutoValue: 0,
      modeManualValue: 1
    }, { targetTemperature: 20 }, "manual");

    expect(plan).toEqual({
      writes: [{ parameter: "CONTROL_MODE", valueType: "int", value: 1 }],
      state: { controlMode: "manual" }
    });
  });

  it("keeps the R4M reversed write direction explicit", () => {
    const plan = openCcuThermostatModePlan({
      interfaceName: "HmIP-RF",
      model: "HmIP-eTRV-B-2 R4M",
      channelType: "HEATING_CLIMATECONTROL_TRANSCEIVER",
      targetTemperatureParameter: "SET_POINT_TEMPERATURE",
      targetTemperatureValueType: "float",
      targetTemperatureMin: 4.5,
      targetTemperatureMax: 30.5
    }, { targetTemperature: 21 }, "manual");

    expect(plan).toEqual({
      writes: [{ parameter: "SET_POINT_MODE", valueType: "int", value: 1 }],
      state: { controlMode: "manual" }
    });
  });
});
