import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionCalls, hasFunction, parseJavaScriptSource } from "./test-utils/source-inspection.js";
import { cssMediaRuleContains, cssRuleContains } from "./test-utils/style-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const ui = readFileSync(new URL("../public/automation-ui.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const uiAst = parseJavaScriptSource(ui, "automation-ui.js");

describe("automation frontend", () => {
  it("provides a navigation page with trigger, optional condition and action fields", () => {
    expect(html).toContain('href="#automations" data-nav="automations"');
    expect(html).toContain('data-page="automations"');
    expect(html).toContain('id="automationTriggerDevice"');
    expect(html).toContain('id="automationConditionEnabled"');
    expect(html).toContain('id="automationAction"');
  });

  it("offers on, off and toggle actions and only boolean device states", () => {
    expect(ui).toContain("const automationActionLabels={turnOn:'An',turnOff:'Aus',toggle:'Toggle'}");
    expect(ui).toContain("typeof value==='boolean'");
    expect(ui).toContain("triggerValue:automationElements.triggerValue.value==='true'");
  });


  it("provides searchable device selectors for trigger, condition and action", () => {
    expect(html).toContain('id="automationTriggerDeviceSearch"');
    expect(html).toContain('id="automationConditionDeviceSearch"');
    expect(html).toContain('id="automationActionDeviceSearch"');
    expect(hasFunction(uiAst, "automationDeviceMatchesSearch")).toBe(true);
    expect(hasFunction(uiAst, "refreshAutomationDeviceSearch")).toBe(true);
    expect(functionCalls(uiAst, "fillAutomationSelect", "automationDeviceMatchesSearch", 2)).toBe(true);
    expect(ui).toContain("device.name,device.room");
    expect(ui).toContain("sourceLabels?.[device.source]");
  });

  it("keeps automation cards responsive on mobile", () => {
    expect(cssRuleContains(styles, ".automation-list", "display:grid")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:620px)", ".automation-card", "padding:11px")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:620px)", ".automation-card-actions", "justify-content:stretch")).toBe(true);
  });
});
