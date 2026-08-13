import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { functionCalls, hasFunction, parseJavaScriptSource } from "../test-utils/source-inspection.js";
import { cssMediaRuleContains, cssRuleContains } from "../test-utils/style-inspection.js";

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
    expect(cssRuleContains(styles, ".automation-form select", "font-size:13px")).toBe(true);
    expect(cssRuleContains(styles, ".automation-device-field>label", "font-size:11.5px")).toBe(true);
  });

  it("allows multiple button event values on primary and additional OR triggers", () => {
    expect(html).toContain('id="automationTriggerEventPicker"');
    expect(html).toContain('id="automationTriggerEventOptions"');
    expect(ui).toContain("automationPrimaryEventValues");
    expect(ui).toContain("automationTogglePrimaryEvent");
    expect(ui).toContain("sameDeviceEventTriggers");
    expect(hasFunction(uiAst, "automationToggleAdditionalEvent")).toBe(true);
    expect(hasFunction(uiAst, "renderAutomationAdditionalEventPicker")).toBe(true);
    expect(functionCalls(uiAst, "automationAdditionalTriggerPayload", "automationAdditionalEventValues", 1)).toBe(true);
    expect(ui).toContain('id="automationExtraEventPicker-${trigger.id}"');
    expect(ui).toContain("automationAdditionalTriggers.flatMap");
    expect(html).toContain("Mehrere Ereignisse werden ODER-verknüpft");
    expect(cssRuleContains(styles, ".automation-event-picker", "border:1px solid var(--line)")).toBe(true);
  });

  it("keeps multiple OR triggers compact and collapsed until they are needed", () => {
    expect(html).toContain('id="automationAdditionalTriggers"');
    expect(html).toContain('id="automationAddTriggerButton"');
    expect(functionCalls(uiAst, "automationPayload", "automationAdditionalTriggerPayload")).toBe(true);
    expect(ui).toContain("sameDeviceEventTriggers");
    expect(ui).toContain("additionalTriggers:");
    expect(hasFunction(uiAst, "addAutomationAdditionalTrigger")).toBe(true);
    expect(hasFunction(uiAst, "renderAutomationAdditionalTriggers")).toBe(true);
    expect(hasFunction(uiAst, "automationStoredAdditionalTriggers")).toBe(true);
    expect(ui).toContain("automationTriggerSummaryItems");
    expect(ui).toContain("automationTriggerSummaryMarkup");
    expect(ui).toContain("Ereignisse");
    expect(cssRuleContains(styles, ".automation-add-trigger", "border:1px dashed var(--line)")).toBe(true);
    expect(cssRuleContains(styles, ".automation-or-trigger-body[hidden]", "display:none")).toBe(true);
  });

  it("shows every OR-trigger device in the rule summary and groups events from the same device", () => {
    const sandbox: Record<string, unknown> = {
      document: { getElementById: () => null },
      all: [
        { id: "left", name: "ZB_SW_LINKS", type: "button", state: { buttonEvent: 1002 } },
        { id: "right", name: "ZB_SW_RECHTS", type: "button", state: { buttonEvent: 1002 } },
      ],
      rooms: [],
      labels: {},
      console,
    };
    runInNewContext(`${ui}\nglobalThis.__automationTriggerSummaryItems=automationTriggerSummaryItems;`, sandbox);
    const summarize = sandbox.__automationTriggerSummaryItems as (rule: unknown) => string[];
    expect(summarize({
      triggerDeviceId: "left",
      triggerStateKey: "event:buttonEvent:1002",
      triggerValue: true,
      additionalTriggers: [
        { deviceId: "left", stateKey: "event:buttonEvent:1004", value: true },
        { deviceId: "right", stateKey: "event:buttonEvent:1002", value: true },
      ],
    })).toEqual([
      "ZB_SW_LINKS · 1002 · Einfachklick / 1004 · Doppelklick",
      "ZB_SW_RECHTS · 1002 · Einfachklick",
    ]);
  });

  it("renders compact automation cards and omits the empty-condition row", () => {
    expect(ui).toContain("summary.conditionText?`<div>");
    expect(ui).not.toContain("Ohne zusätzliche Bedingung");
    expect(ui).toContain('class="automation-card-controls"');
    expect(ui).toContain('class="automation-trigger-list"');
    expect(cssRuleContains(styles, ".automation-list", "gap:8px")).toBe(true);
    expect(cssRuleContains(styles, ".automation-card", "padding:10px 11px")).toBe(true);
    expect(cssRuleContains(styles, ".automation-card", "gap:8px")).toBe(true);
    expect(cssRuleContains(styles, ".automation-card-icon-action", "width:30px")).toBe(true);
    expect(cssRuleContains(styles, ".automation-trigger-list", "flex-wrap:wrap")).toBe(true);
  });

  it("keeps compact automation cards responsive on mobile", () => {
    expect(cssRuleContains(styles, ".automation-list", "display:grid")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:620px)", ".automation-card", "padding:9px")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:620px)", ".automation-card-controls", "gap:4px")).toBe(true);
  });
});
