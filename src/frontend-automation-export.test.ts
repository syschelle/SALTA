import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ui = readFileSync(new URL("../public/automation-ui.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

describe("automation workflow clipboard diagnostics", () => {
  it("offers per-rule and all-workflow clipboard exports", () => {
    expect(html).toContain('onclick="copyAllAutomationWorkflows()"');
    expect(ui).toContain("copyAutomationWorkflow");
    expect(ui).toContain("function automationWorkflowDiagnostic(rule)");
    expect(ui).toContain("format:'salta-automation-workflow-diagnostic'");
    expect(ui).toContain("format:'salta-automation-workflows-diagnostic'");
  });

  it("exports canonical sequence and safe OpenCCU diagnostic metadata without host or credentials", () => {
    expect(ui).toContain("automationCanonicalSequence(rule)");
    expect(ui).toContain("targetTemperatureParameter");
    expect(ui).toContain("manualModeParameter");
    expect(ui).not.toContain("automationDiagnosticAdapterKeys=['host'");
    expect(ui).not.toContain("passwordConfigured','password");
    expect(ui).toContain("document.execCommand('copy')");
  });
});
