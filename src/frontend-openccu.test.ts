import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

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
    expect(script).toContain("async function reconcileOpenCcu()");
    expect(script).toContain("async function diagnoseOpenCcu()");
    expect(html).toContain('id="openCcuDiagnosticFeedback"');
    expect(html).toContain('id="openCcuDiagnosticReport"');
    expect(html).toContain('id="openCcuDiagnoseButton"');
    expect(script).toContain("Remote-Code ${step.remoteCode}");
  });
});
