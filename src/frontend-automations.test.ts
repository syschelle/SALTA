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
    expect(html).toContain('id="automationAdditionalConditions"');
    expect(html).toContain('id="automationAddConditionButton"');
    expect(html).toContain("Weitere UND-Bedingung hinzufügen");
    expect(hasFunction(uiAst, "addAutomationAdditionalCondition")).toBe(true);
    expect(hasFunction(uiAst, "automationAdditionalConditionPayload")).toBe(true);
    expect(html).toContain('id="automationAction"');
    expect(html).toContain('id="automationRoom"');
  });

  it("offers a daily local-time trigger without requiring a device", () => {
    expect(html).toContain('id="automationTriggerType"');
    expect(html).toContain('<option value="time">Uhrzeit</option>');
    expect(html).toContain('id="automationTriggerTime" type="time"');
    expect(html).toContain('Täglich in der SALTA-Zeitzone (TZ).');
    expect(hasFunction(uiAst, "updateAutomationTriggerMode")).toBe(true);
    expect(hasFunction(uiAst, "automationTimeTriggerActive")).toBe(true);
    expect(ui).toContain("triggerType:timeTrigger?'time':'device'");
    expect(ui).toContain("timeTrigger?{triggerTime:automationElements.triggerTime.value}");
    expect(ui).toContain("Täglich · ${rule.triggerTime||'–'} Uhr");
    expect(ui).toContain("automationElements.additionalTriggers.hidden=timeTrigger");
    expect(cssRuleContains(styles, ".automation-trigger-type-row", "grid-template-columns:minmax(0,1fr) minmax(0,1fr)")).toBe(true);
    expect(cssRuleContains(styles, ".automation-additional-triggers[hidden]", "display:none")).toBe(true);
  });

  it("offers the global SALTA heating mode as an automation target", () => {
    expect(ui).toContain("climateSummer:'Sommermodus'");
    expect(ui).toContain("climateWinter:'Wintermodus'");
    expect(ui).toContain("device.source==='system'&&device.adapterData?.systemKind==='climateMode'");
    expect(html).toContain('aria-label="Ziel nach Name, Raum, Quelle oder SALTA-Funktion suchen"');
  });

  it("offers the global SALTA heating mode as an optional condition but not as a device trigger", () => {
    expect(ui).toContain("function automationIsClimateModeDevice(device)");
    expect(ui).toContain("!automationIsClimateModeDevice(device)");
    expect(ui).toContain("key==='winterActive'?'Heizmodus'");
    expect(ui).toContain("winterActive:['Wintermodus','Sommermodus']");
    expect(ui).toContain("automationIsClimateModeDevice(device)?`Heizmodus = ${automationValueLabel(condition.stateKey,condition.value)}`");
    expect(ui).toContain("const conditionText=conditionItems.length?`Nur wenn ${conditionItems.join(' UND ')}`:null;");
    expect(html).toContain('Gerät / SALTA-Funktion');
    expect(html).toContain('aria-label="Bedingung nach Name, Raum, Quelle oder SALTA-Funktion suchen"');
  });

  it("offers boolean state transitions and deCONZ button-event triggers", () => {
    expect(ui).toContain("turnOn:'An',turnOff:'Aus',toggle:'Toggle'");
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

  it("supports multiple Nur-wenn conditions with AND semantics", () => {
    expect(ui).toContain("additionalConditions:useCondition?automationAdditionalConditionPayload():[]");
    expect(ui).toContain("conditionItems.join(' UND ')");
    expect(ui).toContain("Maximal acht UND-Bedingungen pro Automation.");
    expect(styles).toContain(".automation-additional-conditions");
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
  it("allows a virtual on-trigger to select itself only as a safe off reset", () => {
    const elements: Record<string, any> = {
      automationTriggerDevice: { value: "virtual-geofence", addEventListener() {} },
      automationTriggerState: { value: "on", addEventListener() {} },
      automationTriggerValue: { value: "true", addEventListener() {} },
      automationActionDevice: { value: "", addEventListener() {} },
    };
    const sandbox: Record<string, unknown> = {
      document: { getElementById: (id: string) => elements[id] ?? null },
      all: [
        { id: "virtual-geofence", name: "Geofence", source: "virtual", type: "switch", state: { on: true }, capabilities: ["turnOn", "turnOff", "toggle"] },
        { id: "physical", name: "Physical", source: "shelly", type: "switch", state: { on: true }, capabilities: ["turnOn", "turnOff", "toggle"] },
      ],
      rooms: [], labels: {}, sourceLabels: { virtual: "Virtuell", shelly: "Shelly" }, typeLabels: {}, console,
    };
    runInNewContext(`${ui}\nglobalThis.__allowed=automationTargetDeviceAllowed;globalThis.__actions=automationActionsForTargetDevice;`, sandbox);
    const allowed = sandbox.__allowed as (device: unknown, used?: Set<string>) => boolean;
    const actions = sandbox.__actions as (id: string) => string[];
    expect(allowed((sandbox.all as any[])[0])).toBe(true);
    expect(actions("virtual-geofence")).toEqual(["turnOff"]);

    elements.automationTriggerDevice.value = "physical";
    expect(allowed((sandbox.all as any[])[1])).toBe(false);
    expect(actions("physical")).toEqual([]);
  });

  it("supports multiple target devices in the Dann step", () => {
    expect(html).toContain('id="automationAdditionalActions"');
    expect(html).toContain('id="automationAddActionButton"');
    expect(html).toContain("Weiteres Ziel hinzufügen");
    expect(ui).toContain("automationAdditionalActions");
    expect(hasFunction(uiAst, "addAutomationAdditionalAction")).toBe(true);
    expect(hasFunction(uiAst, "renderAutomationAdditionalActions")).toBe(true);
    expect(hasFunction(uiAst, "automationAdditionalActionPayload")).toBe(true);
    expect(hasFunction(uiAst, "automationActionSummaryItems")).toBe(true);
    expect(ui).toContain("additionalActions:automationAdditionalActionPayload()");
    expect(ui).toContain("automationActionSummaryMarkup(summary.actionItems)");
    expect(ui).toContain("device.source==='virtual'");
    expect(hasFunction(uiAst, "automationVirtualSelfResetAction")).toBe(true);
    expect(hasFunction(uiAst, "automationActionsForTargetDevice")).toBe(true);
    expect(ui).toContain("device.source==='openccu'");
    expect(ui).toContain("thermostatOff:'Thermostat Aus'");
    expect(ui).toContain("actions.push('thermostatOff','thermostatAuto','thermostatManual')");
    expect(ui).toContain("actions.push('setTargetTemperature')");
    expect(html).toContain('id="automationActionValue"');
    expect(ui).toContain("setTargetTemperature:'Solltemperatur setzen'");
    expect(ui).toContain("automationNormalizeTemperature");
    expect(ui).toContain("actionValue:automationNormalizeTemperature");
    expect(cssRuleContains(styles, ".automation-action-value-field[hidden]", "display:none")).toBe(true);
    expect(cssRuleContains(styles, ".automation-add-action", "border:1px dashed var(--line)")).toBe(true);
    expect(cssRuleContains(styles, ".automation-extra-action-body[hidden]", "display:none")).toBe(true);
    expect(cssRuleContains(styles, ".automation-action-list", "flex-wrap:wrap")).toBe(true);
  });


  it("does not show the virtual self-reset explanatory hint in the automation editor", () => {
    expect(html).not.toContain("Virtuelle Trigger-Schalter können sich sicher selbst zurücksetzen");
    expect(html).not.toContain("automation-self-reset-hint");
  });

});
