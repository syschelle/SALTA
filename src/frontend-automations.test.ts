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
    expect(html).toContain('id="automationRoom"');
  });

  it("offers boolean state transitions and deCONZ button-event triggers", () => {
    expect(ui).toContain("const automationActionLabels={turnOn:'An',turnOff:'Aus',toggle:'Toggle'}");
    expect(ui).toContain("typeof value==='boolean'");
    expect(ui).toContain("automationButtonEventMarker='event:buttonEvent'");
    expect(ui).toContain("triggerStateKey:eventTrigger?`event:buttonEvent:${eventValue}`");
    expect(ui).toContain("'lumi.remote.b1acn01':[1002,1004,1001,1003]");
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

  it("keeps the editor aligned, supports room assignment and formats the last event relatively", () => {
    expect(html).toContain('class="page-form automation-form"');
    expect(html).toContain('class="automation-form-basics"');
    expect(html).toContain('class="automation-field-row"');
    expect(ui).toContain("roomId:automationElements.room?.value||null");
    expect(hasFunction(uiAst, "fillAutomationRoomSelect")).toBe(true);
    expect(hasFunction(uiAst, "automationLastEventLabel")).toBe(true);
    expect(ui).toContain("days===0?'Heute':days===1?'Gestern':`vor ${days} Tagen`");
    expect(cssRuleContains(styles, ".page-form .automation-device-search", "display:flex")).toBe(true);
    expect(cssRuleContains(styles, ".automation-field-row", "grid-template-columns:minmax(0,1fr) minmax(0,1fr)")).toBe(true);
  });

  it("keeps automation cards responsive on mobile", () => {
    expect(cssRuleContains(styles, ".automation-list", "display:grid")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:620px)", ".automation-card", "padding:11px")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:620px)", ".automation-card-actions", "justify-content:stretch")).toBe(true);
  });
});
