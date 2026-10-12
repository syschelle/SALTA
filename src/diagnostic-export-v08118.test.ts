import { describe, expect, it } from "vitest";
import type { Device } from "./types.js";
import { safeDiagnosticDevice } from "./diagnostic-export.js";

describe("v0.8.118 sanitized diagnostic device export", () => {
  it("removes presence network identifiers from the general device block", () => {
    const device = {
      id: "presence:person",
      source: "presence",
      sourceId: "person",
      type: "genericSensor",
      name: "Phone",
      host: "192.168.178.10",
      hostname: "phone.local",
      macAddress: "AA:BB:CC:DD:EE:FF",
      reachable: true,
      state: {
        present: true,
        hostName: "phone.local",
        ipAddress: "192.168.178.10",
        interfaceType: "802.11"
      },
      capabilities: [],
      adapterData: {
        targetId: "person",
        configuredIpAddress: "192.168.178.10",
        configuredMacAddress: "AA:BB:CC:DD:EE:FF",
        absenceDelaySeconds: 600
      }
    } as unknown as Device;

    expect(safeDiagnosticDevice(device)).toEqual({
      id: "presence:person",
      source: "presence",
      sourceId: "person",
      type: "genericSensor",
      name: "Phone",
      reachable: true,
      state: {
        present: true,
        interfaceType: "802.11"
      },
      capabilities: [],
      adapterData: {
        targetId: "person",
        absenceDelaySeconds: 600
      }
    });
  });

  it("keeps OpenCCU datapoint metadata needed for troubleshooting", () => {
    const device = {
      id: "openccu:BidCos-RF:MEQ0004123_3A2",
      source: "openccu",
      sourceId: "BidCos-RF|MEQ0004123:2",
      type: "thermostat",
      name: "Arbeitszimmerwandthermostat",
      reachable: true,
      state: { controlMode: "off", targetTemperature: 4.5 },
      capabilities: ["setTargetTemperature", "setThermostatMode"],
      adapterData: {
        interfaceName: "BidCos-RF",
        channelAddress: "MEQ0004123:2",
        targetTemperatureParameter: "SET_TEMPERATURE",
        manualModeParameter: "MANU_MODE"
      }
    } as unknown as Device;

    expect(safeDiagnosticDevice(device)).toMatchObject({
      adapterData: {
        interfaceName: "BidCos-RF",
        channelAddress: "MEQ0004123:2",
        targetTemperatureParameter: "SET_TEMPERATURE",
        manualModeParameter: "MANU_MODE"
      }
    });
  });
});
