import { describe, expect, it } from "vitest";
import { gatewayStatus } from "./phoscon-core.js";

describe("deCONZ gateway health", () => {
  it("reports a healthy radio when the authenticated gateway config is connected", () => {
    expect(gatewayStatus({ config: { devicename: "ConBee II", fwversion: "0x26780700", rfconnected: true, zigbeechannel: 11 } }))
      .toMatchObject({ connected: true, health: "ok", rfConnected: true, firmwareVersion: "0x26780700", zigbeeChannel: 11 });
  });

  it("reports a radio fault when deCONZ is reachable but the ConBee radio is disconnected", () => {
    expect(gatewayStatus({ config: { devicename: "ConBee II", fwversion: "0x00000000", rfconnected: false, zigbeechannel: 11 } }))
      .toMatchObject({ connected: true, health: "radio-disconnected", rfConnected: false, firmwareVersion: "0x00000000" });
  });

  it("keeps older gateways with no rfconnected field explicitly unknown", () => {
    expect(gatewayStatus({ config: { devicename: "ConBee II", fwversion: "0x26780700" } }).health).toBe("unknown");
  });
});
