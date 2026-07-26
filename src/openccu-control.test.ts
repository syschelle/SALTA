import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adapter = readFileSync(new URL("./openccu-adapter.ts", import.meta.url), "utf8");
const core = readFileSync(new URL("./openccu-core.ts", import.meta.url), "utf8");
const frontend = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

describe("OpenCCU control and naming integration", () => {
  it("resolves physical names and writable parameter metadata during catalogue refresh", () => {
    expect(adapter).toContain('client.call("Device.listAll")');
    expect(adapter).toContain('client.call("Device.get", { id })');
    expect(adapter).toContain('client.call("Interface.getParamsetDescription"');
    expect(adapter).toContain("openCcuObjectName(result)");
  });

  it("supports thermostat target-temperature commands and UI controls", () => {
    expect(adapter).toContain('command.capability === "setTargetTemperature"');
    expect(adapter).toContain('metadata.targetTemperatureValueType ?? "float"');
    expect(frontend).toContain("targetTemperatureControl(d)");
    expect(frontend).toContain("setTargetTemperature('${d.id}',this.value)");
  });

  it("supports thermostat off, manual and automatic mode commands", () => {
    expect(adapter).toContain('command.capability === "setThermostatMode"');
    expect(adapter).toContain("openCcuThermostatModePlan(metadata, device.state, command.value)");
    expect(core).toContain('metadata.autoModeParameter');
    expect(core).toContain('metadata.manualModeParameter');
    expect(core).toContain('metadata.modeAutoValue');
    expect(frontend).toContain("thermostatModeControl(d)");
    expect(frontend).toContain("setThermostatMode('${d.id}','${value}')");
    expect(frontend).toContain("['off','Aus'");
    expect(frontend).toContain("['manual','Hand'");
    expect(frontend).toContain("['auto','Automatik'");
  });
});
