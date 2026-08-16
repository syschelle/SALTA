import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cssMediaRuleContains, cssRuleContains } from "../test-utils/style-inspection.js";
import { functionCalls, functionCallsWithStringArgument, hasFunction, parseJavaScriptSource } from "../test-utils/source-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const app = parseJavaScriptSource(script);

describe("system overview controls", () => {
  it("shows the Phoscon daylight sensor beside the climate control", () => {
    expect(html).toContain('class="panel overview-system-card daylight-overview-card"');
    expect(html).toContain('id="daylightOverviewStatus"');
    expect(html.indexOf('daylight-overview-card')).toBeLessThan(html.indexOf('climate-mode-card'));
    expect(hasFunction(app, "daylightOverviewDevice")).toBe(true);
    expect(hasFunction(app, "renderDaylightOverview")).toBe(true);
    expect(functionCalls(app, "renderDaylightOverview", "daylightOverviewDevice")).toBe(true);
    expect(functionCalls(app, "renderDaylightOverview", "daylightTimeLabel")).toBe(true);
    expect(cssRuleContains(styles, ".daylight-times", "grid-template-columns:1fr 1fr")).toBe(true);
  });

  it("shows a compact summer/winter thermostat control without the old SALTA-only badge", () => {
    expect(html).toContain('id="climateSummerButton"');
    expect(html).toContain('id="climateWinterButton"');
    expect(html).toContain('id="climateWinterModeDisplay"');
    expect(html).toContain('data-settings-panel="climate"');
    expect(html).toContain('id="climateSettingsWinterMode"');
    expect(html).toContain('id="climateApplyNowButton"');
    expect(html).toContain('class="panel overview-system-card climate-mode-card" data-homekit-exposed="false"');
    expect(html).not.toContain('<span class="system-card-badge">Nur SALTA</span>');
    expect(html).toContain("onclick=\"applyClimateMode('summer')\"");
    expect(html).toContain("onclick=\"applyClimateMode('winter')\"");
    expect(hasFunction(app, "applyClimateMode")).toBe(true);
    expect(functionCallsWithStringArgument(app, "applyClimateMode", "api", "/api/system/climate-mode")).toBe(true);
    expect(functionCallsWithStringArgument(app, "saveClimateSettings", "api", "/api/settings/climate-mode")).toBe(true);
    expect(cssRuleContains(styles, ".overview-system-card", "padding:11px 12px")).toBe(true);
    expect(cssRuleContains(styles, ".climate-mode-row", "grid-template-columns:1fr")).toBe(true);
    expect(cssRuleContains(styles, ".climate-winter-mode-display", "justify-content:space-between")).toBe(true);
  });

  it("shows battery status and keeps Pushover configuration compact", () => {
    expect(html).toContain('id="batteryOverviewStatus"');
    expect(html).toContain('class="system-card-action"');
    expect(html).toContain('data-settings-panel="notifications"');
    expect(html).toContain('id="notificationBatteryThreshold"');
    expect(html).toContain('id="notificationTestButton"');
    expect(hasFunction(app, "renderBatteryOverview")).toBe(true);
    expect(functionCallsWithStringArgument(app, "loadSystemControls", "api", "/api/settings/notifications")).toBe(true);
    expect(html).toContain('data-settings-panel="general"');
    expect(html).toContain('id="generalDebugLevel"');
    expect(html).toContain('id="debugModeIndicator"');
    expect(hasFunction(app, "renderDebugModeIndicator")).toBe(true);
    expect(functionCallsWithStringArgument(app, "loadSystemControls", "api", "/api/settings/general")).toBe(true);
    expect(functionCallsWithStringArgument(app, "saveGeneralSettings", "api", "/api/settings/general")).toBe(true);
    expect(cssRuleContains(styles, ".debug-mode-indicator", "position:sticky")).toBe(true);
    expect(functionCallsWithStringArgument(app, "testPushover", "api", "/api/settings/notifications/test")).toBe(true);
    expect(cssRuleContains(styles, ".battery-overview-status", "min-height:50px")).toBe(true);
  });

  it("presents the four global controls as equal compact quick-control cards", () => {
    expect(cssRuleContains(styles, ".overview-system-grid", "grid-template-columns:repeat(4,minmax(0,1fr))")).toBe(true);
    expect(cssRuleContains(styles, ".overview-system-card", "min-height:136px")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:1280px)", ".overview-system-grid", "grid-template-columns:repeat(2,minmax(0,1fr))")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:560px)", ".overview-system-grid", "grid-template-columns:1fr")).toBe(true);
    expect(html).not.toContain('Aktuelle Sonnenphase sowie Auf- und Untergang.');
    expect(html).not.toContain('Überwacht Fenster- und Türkontakte und alarmiert per Pushover.');
    expect(html).not.toContain('Alle kompatiblen Thermostate zentral umschalten.');
    expect(html).not.toContain('Batteriestände und Low-Battery-Meldungen im Blick.');
  });

  it("does not show the Phoscon badge on the daylight overview card", () => {
    expect(html).toContain('<h2>Tageslicht</h2>');
    expect(html).not.toContain('<h2>Tageslicht</h2><span class="system-card-badge">Phoscon</span>');
  });


  it("shows a global vacation mode control and loads it with the other system controls", () => {
    expect(html).toContain('<h2>Urlaubsmodus</h2>');
    expect(html).toContain('id="vacationModeOffButton"');
    expect(html).toContain('id="vacationModeOnButton"');
    expect(html).toContain('id="vacationModeStatus"');
    expect(script).toContain("api('/api/system/vacation-mode')");
    expect(html).toContain("onclick=\"applyVacationMode(false)\"");
    expect(html).toContain("onclick=\"applyVacationMode(true)\"");
    expect(hasFunction(app, "applyVacationMode")).toBe(true);
    expect(functionCallsWithStringArgument(app, "applyVacationMode", "api", "/api/system/vacation-mode")).toBe(true);
  });

});
