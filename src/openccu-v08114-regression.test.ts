import { describe, expect, it } from "vitest";
import { openCcuTargetTemperaturePlan } from "./openccu-core.js";

const classicMetadata = {
  interfaceName: "BidCos-RF",
  channelType: "CLIMATECONTROL_RT_TRANSCEIVER",
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

describe("v0.8.114 OpenCCU target-temperature mode isolation", () => {
  it("changes only SET_TEMPERATURE while classic HomeMatic is in manual mode", () => {
    expect(openCcuTargetTemperaturePlan(classicMetadata, { controlMode: "manual", targetTemperature: 20 }, 15)).toEqual({
      writes: [{ parameter: "SET_TEMPERATURE", valueType: "float", value: 15 }],
      state: { targetTemperature: 15 }
    });
  });

  it("does not emit MANU_MODE even when classic HomeMatic reports OFF", () => {
    expect(openCcuTargetTemperaturePlan(classicMetadata, { controlMode: "off", targetTemperature: 4.5 }, 15)).toEqual({
      writes: [{ parameter: "SET_TEMPERATURE", valueType: "float", value: 15 }],
      state: { targetTemperature: 15 }
    });
  });

  it("does not emit AUTO_MODE or MANU_MODE while classic HomeMatic is in AUTO", () => {
    expect(openCcuTargetTemperaturePlan(classicMetadata, { controlMode: "auto", targetTemperature: 20 }, 15)).toEqual({
      writes: [{ parameter: "SET_TEMPERATURE", valueType: "float", value: 15 }],
      state: { targetTemperature: 15 }
    });
  });

  it("continues to use the native HmIP target-temperature datapoint", () => {
    expect(openCcuTargetTemperaturePlan({
      ...classicMetadata,
      interfaceName: "HmIP-RF",
      model: "HmIP-WTH-2",
      targetTemperatureParameter: "SET_POINT_TEMPERATURE"
    }, { controlMode: "manual", targetTemperature: 20 }, 15)).toEqual({
      writes: [{ parameter: "SET_POINT_TEMPERATURE", valueType: "float", value: 15 }],
      state: { targetTemperature: 15 }
    });
  });
});
