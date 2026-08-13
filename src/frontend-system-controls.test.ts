import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cssMediaRuleContains, cssRuleContains } from "../test-utils/style-inspection.js";
import { functionCallsWithStringArgument, hasFunction, parseJavaScriptSource } from "../test-utils/source-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const app = parseJavaScriptSource(script);

describe("system climate and battery controls", () => {
  it("shows a compact SALTA-only summer/winter thermostat control", () => {
    expect(html).toContain('id="climateSummerButton"');
    expect(html).toContain('id="climateWinterButton"');
    expect(html).toContain('id="climateWinterMode"');
    expect(html).toContain('class="panel overview-system-card climate-mode-card" data-homekit-exposed="false"');
    expect(html).toContain("onclick=\"applyClimateMode('summer')\"");
    expect(html).toContain("onclick=\"applyClimateMode('winter')\"");
    expect(hasFunction(app, "applyClimateMode")).toBe(true);
    expect(functionCallsWithStringArgument(app, "applyClimateMode", "api", "/api/system/climate-mode")).toBe(true);
    expect(cssRuleContains(styles, ".overview-system-card", "padding:13px 15px")).toBe(true);
    expect(cssRuleContains(styles, ".climate-mode-row", "grid-template-columns:minmax(220px,1fr) minmax(180px,220px)")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:620px)", ".climate-mode-row", "grid-template-columns:1fr")).toBe(true);
  });

  it("shows battery status and keeps Pushover configuration compact", () => {
    expect(html).toContain('id="batteryOverviewStatus"');
    expect(html).toContain('class="system-card-action"');
    expect(html).toContain('data-settings-panel="notifications"');
    expect(html).toContain('id="notificationBatteryThreshold"');
    expect(html).toContain('id="notificationTestButton"');
    expect(hasFunction(app, "renderBatteryOverview")).toBe(true);
    expect(functionCallsWithStringArgument(app, "loadSystemControls", "api", "/api/settings/notifications")).toBe(true);
    expect(functionCallsWithStringArgument(app, "testPushover", "api", "/api/settings/notifications/test")).toBe(true);
    expect(cssRuleContains(styles, ".battery-overview-status", "min-height:44px")).toBe(true);
  });
});
