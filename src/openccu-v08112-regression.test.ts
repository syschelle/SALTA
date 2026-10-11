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
  manualModeParameter: "MANU_MODE",
  manualModeValueType: "float"
};

describe("v0.8.112 classic HomeMatic target-temperature regression", () => {
  it("keeps a classic HomeMatic thermostat in manual mode while applying night setback", () => {
    expect(openCcuTargetTemperaturePlan(classicMetadata, { controlMode: "manual", targetTemperature: 20 }, 15)).toEqual({
      writes: [{ parameter: "MANU_MODE", valueType: "float", value: 15 }],
      state: { controlMode: "manual", targetTemperature: 15 }
    });
  });

  it("wakes a classic HomeMatic thermostat from OFF into manual mode at the requested temperature", () => {
    expect(openCcuTargetTemperaturePlan(classicMetadata, { controlMode: "off", targetTemperature: 4.5 }, 15)).toEqual({
      writes: [{ parameter: "MANU_MODE", valueType: "float", value: 15 }],
      state: { controlMode: "manual", targetTemperature: 15 }
    });
  });

  it("preserves AUTO when a normal setpoint write is requested outside manual mode", () => {
    expect(openCcuTargetTemperaturePlan(classicMetadata, { controlMode: "auto", targetTemperature: 20 }, 15)).toEqual({
      writes: [{ parameter: "SET_TEMPERATURE", valueType: "float", value: 15 }],
      state: { targetTemperature: 15 }
    });
  });

  it("does not route HmIP temperatures through MANU_MODE even if stale metadata contains it", () => {
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
