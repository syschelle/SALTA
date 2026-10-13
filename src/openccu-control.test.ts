import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionSource, functionTransitivelyCalls, hasFunction, parseJavaScriptSource } from "../test-utils/source-inspection.js";

const adapter = readFileSync(new URL("./openccu-adapter.ts", import.meta.url), "utf8");
const thermostatController = readFileSync(new URL("./openccu-thermostat-controller.ts", import.meta.url), "utf8");
const core = readFileSync(new URL("./openccu-core.ts", import.meta.url), "utf8");
const frontend = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const automationFrontend = readFileSync(new URL("../public/automation-ui.js", import.meta.url), "utf8");
const frontendAst = parseJavaScriptSource(frontend);

describe("OpenCCU control and naming integration", () => {
  it("resolves physical names and writable parameter metadata during catalogue refresh", () => {
    expect(adapter).toContain('client.call("Device.listAll")');
    expect(adapter).toContain('client.call("Device.get", { id })');
    expect(adapter).toContain('client.call("Interface.getParamsetDescription"');
    expect(adapter).toContain("openCcuObjectName(result)");
  });

  it("isolates thermostat target-temperature commands from the generic OpenCCU adapter", () => {
    expect(adapter).toContain("THERMOSTAT_CONTROL_ROUTED_EXTERNALLY");
    expect(adapter).not.toContain("openCcuTargetTemperaturePlan(");
    expect(thermostatController).toContain("openCcuTargetTemperaturePlan(metadata, liveBefore.state, command.value)");
    expect(thermostatController).toContain('"Interface.getParamset"');
    expect(thermostatController).toContain('"Interface.setValue"');
    expect(core).toContain('valueType: stringValue(metadata.targetTemperatureValueType) ?? "float"');
    expect(core).toContain("parameter: targetParameter");
    expect(core).not.toContain('manualModeParameter && (currentMode === "manual" || currentMode === "off")');
    expect(hasFunction(frontendAst, "targetTemperatureControl")).toBe(true);
    expect(functionTransitivelyCalls(frontendAst, "deviceCard", "targetTemperatureControl", 1)).toBe(true);
    expect(functionSource(frontendAst, "targetTemperatureControl")).toContain(
      "setTargetTemperature('${d.id}',this.value)",
    );
  });

  it("isolates thermostat off, manual and automatic mode commands", () => {
    expect(adapter).toContain("THERMOSTAT_CONTROL_ROUTED_EXTERNALLY");
    expect(adapter).not.toContain("openCcuThermostatModePlan(");
    expect(thermostatController).toContain("openCcuThermostatModePlan(metadata, liveBefore.state, command.value)");
    expect(core).toContain('metadata.autoModeParameter');
    expect(core).toContain('metadata.manualModeParameter');
    expect(core).toContain('metadata.modeAutoValue');
    expect(hasFunction(frontendAst, "thermostatModeControl")).toBe(true);
    expect(functionTransitivelyCalls(frontendAst, "deviceCard", "thermostatModeControl", 1)).toBe(true);
    expect(frontend).toContain("setThermostatMode('${d.id}','${value}')");
    expect(frontend).toContain("['off','Aus'");
    expect(frontend).toContain("['manual','Hand'");
    expect(frontend).toContain("['auto','Automatik'");
  });

  it("registers realtime XML-RPC callbacks for HomeMatic KEY and classic contact events", () => {
    expect(adapter).toContain("OpenCcuXmlRpcCallbackServer");
    expect(adapter).toContain("openCcuButtonEventValue(event.parameter)");
    expect(adapter).toContain("openCcuContactStateEventValue(channelType, event.parameter, event.value)");
    expect(adapter).toContain("candidate.adapterData?.channelAddress === event.channelAddress");
    expect(adapter).toContain("openCcuContactChannelType(entry.channelType)");
    expect(adapter).toContain("this.runExclusive(() => this.applyRealtimeEvent(event))");
    expect(adapter).toContain('stateEventOrigin: "openccu-xmlrpc"');
    expect(adapter).toContain('stateEventOrigin: "openccu-poll"');
    expect(adapter).toContain('key: "buttonEvent"');
    expect(adapter).toContain("callbackServer.invalidateRegistrations()");
    expect(core).toContain('snapshot.channelType.trim().toUpperCase() === "KEY"');
    expect(core).toContain("export function openCcuContactStateEventValue");
    expect(automationFrontend).toContain("'hm-pb-6-wm55':[1002,1001,1003]");
  });
});