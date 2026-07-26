import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasFunction, parseJavaScriptSource } from "./test-utils/source-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const scriptAst = parseJavaScriptSource(script);

describe("OpenCCU frontend integration", () => {
  it("provides a separate HomeMatic page and navigation entry", () => {
    expect(html).toContain('href="#openccu" data-nav="openccu"');
    expect(html).toContain('data-page="openccu"');
    expect(html).toContain('id="openCcuGrid" class="device-groups"');
    expect(script).toContain("renderDeviceGrid('openccu',openCcuGrid,openCcuFilter,openCcuRoomFilter)");
  });

  it("provides OpenCCU connection settings without per-device credentials", () => {
    expect(html).toContain('data-settings-content="openccu"');
    expect(html).toContain('id="openCcuBaseUrl"');
    expect(html).toContain('id="openCcuUsername"');
    expect(html).toContain('id="openCcuPassword"');
    expect(script).toContain("api('/api/settings/openccu'");
    expect(script).toContain("const openccu=selectedDevice.source==='openccu'");
    expect(script).toContain("deviceCredentialSection.hidden=!shelly");
  });

  it("synchronizes and diagnoses OpenCCU inside the application", () => {
    expect(script).toContain("api('/api/adapters/openccu/reconcile',{method:'POST'})");
    expect(script).toContain("api('/api/settings/openccu/diagnose'");
    expect(hasFunction(scriptAst, "reconcileOpenCcu")).toBe(true);
    expect(hasFunction(scriptAst, "diagnoseOpenCcu")).toBe(true);
    expect(html).toContain('id="openCcuDiagnosticFeedback"');
    expect(html).toContain('id="openCcuDiagnosticReport"');
    expect(html).toContain('id="openCcuDiagnoseButton"');
    expect(script).toContain("Remote-Code ${step.remoteCode}");
  });

  it("renders HomeMatic thermostat mode controls", () => {
    expect(hasFunction(scriptAst, "thermostatModeControl")).toBe(true);
    expect(script).toContain("capabilities.includes('setThermostatMode')");
    expect(script).toContain("d.source==='openccu'&&d.type==='thermostat'&&d.capabilities.includes('setTargetTemperature')&&Boolean(displayed)");
    expect(script).toContain("const displayed=String(d.state?.controlMode||'').trim()");
    expect(script).toContain("displayed?fmt('controlMode',displayed):'–'");
    expect(script).toContain("Betriebsart");
    expect(script).toContain("Betriebsart auf ${labels[mode]||mode} gesetzt.");
  });
});
