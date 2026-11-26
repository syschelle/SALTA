import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeOpenCcuMaintenanceValues, openCcuMaintenanceAddress, openCcuDeviceFromChannel } from "./openccu-core.js";

const adapterSource = readFileSync(new URL("./openccu-adapter.ts", import.meta.url), "utf8");

describe("OpenCCU BidCos battery maintenance", () => {
  it("reads classic BidCos service values from physical channel 0 only", () => {
    expect(openCcuMaintenanceAddress("BidCos-RF", "MEQ1234567")).toBe("MEQ1234567:0");
    expect(openCcuMaintenanceAddress("HmIP-RF", "001122334455")).toBeUndefined();
    expect(adapterSource).toContain("OPENCCU_MAINTENANCE_READ_PARTIAL");
    expect(adapterSource).toContain("address: target.address");
    expect(adapterSource).toContain("mergeOpenCcuMaintenanceValues(entry.interfaceName, channelValues, maintenance)");
  });

  it("merges LOWBAT from channel 0 into a classic HomeMatic thermostat state", () => {
    const values = mergeOpenCcuMaintenanceValues(
      "BidCos-RF",
      { SET_TEMPERATURE: 20, ACTUAL_TEMPERATURE: 21.3 },
      { LOWBAT: true, UNREACH: false }
    );
    const device = openCcuDeviceFromChannel({
      baseUrl: "http://openccu.local",
      interfaceName: "BidCos-RF",
      channelAddress: "MEQ1234567:4",
      channelType: "THERMOSTAT",
      deviceAddress: "MEQ1234567",
      model: "HM-CC-RT-DN",
      paramsetDescription: {
        SET_TEMPERATURE: { TYPE: "FLOAT", OPERATIONS: 3, MIN: 4.5, MAX: 30 }
      },
      values
    });
    expect(device).toBeDefined();
    expect(device?.state.lowBattery).toBe(true);
  });

  it("does not apply BidCos maintenance data to HmIP channels implicitly", () => {
    expect(mergeOpenCcuMaintenanceValues("HmIP-RF", { STATE: true }, { LOW_BAT: true }))
      .toEqual({ STATE: true });
  });
});
