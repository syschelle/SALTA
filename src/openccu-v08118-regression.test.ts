import { describe, expect, it } from "vitest";
import { openCcuTargetTemperaturePlan } from "./openccu-core.js";

const classicMetadata = {
  interfaceName: "BidCos-RF",
  channelType: "THERMALCONTROL_TRANSMIT",
  model: "HM-TC-IT-WM-W-EU",
  targetTemperatureParameter: "SET_TEMPERATURE",
  targetTemperatureValueType: "float",
  targetTemperatureMin: 4.5,
  targetTemperatureMax: 30.5,
  autoModeParameter: "AUTO_MODE",
  autoModeValueType: "bool",
  manualModeParameter: "MANU_MODE",
  manualModeValueType: "float"
};

describe("v0.8.118 classic BidCos OFF target-temperature recovery", () => {
  it("uses MANU_MODE with the requested temperature when raising a classic thermostat from OFF", () => {
    expect(openCcuTargetTemperaturePlan(classicMetadata, { controlMode: "off", targetTemperature: 4.5 }, 15)).toEqual({
      writes: [{ parameter: "MANU_MODE", valueType: "float", value: 15 }],
      state: { controlMode: "manual", targetTemperature: 15 }
    });
  });

  it("keeps a minimum-temperature request on the native target datapoint", () => {
    expect(openCcuTargetTemperaturePlan(classicMetadata, { controlMode: "off", targetTemperature: 4.5 }, 4.5)).toEqual({
      writes: [{ parameter: "SET_TEMPERATURE", valueType: "float", value: 4.5 }],
      state: { targetTemperature: 4.5 }
    });
  });

  it("keeps classic manual and AUTO temperature-only actions on SET_TEMPERATURE", () => {
    expect(openCcuTargetTemperaturePlan(classicMetadata, { controlMode: "manual", targetTemperature: 20 }, 15)).toEqual({
      writes: [{ parameter: "SET_TEMPERATURE", valueType: "float", value: 15 }],
      state: { targetTemperature: 15 }
    });
    expect(openCcuTargetTemperaturePlan(classicMetadata, { controlMode: "auto", targetTemperature: 20 }, 15)).toEqual({
      writes: [{ parameter: "SET_TEMPERATURE", valueType: "float", value: 15 }],
      state: { targetTemperature: 15 }
    });
  });

  it("does not apply the classic BidCos OFF exception to HmIP", () => {
    expect(openCcuTargetTemperaturePlan({
      ...classicMetadata,
      interfaceName: "HmIP-RF",
      channelType: "HEATING_CLIMATECONTROL_TRANSCEIVER",
      model: "HmIP-WTH-2",
      targetTemperatureParameter: "SET_POINT_TEMPERATURE"
    }, { controlMode: "off", targetTemperature: 4.5 }, 15)).toEqual({
      writes: [{ parameter: "SET_POINT_TEMPERATURE", valueType: "float", value: 15 }],
      state: { targetTemperature: 15 }
    });
  });
});
