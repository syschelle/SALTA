import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const html=readFileSync(new URL("../public/index.html",import.meta.url),"utf8");
const script=readFileSync(new URL("../public/app.js",import.meta.url),"utf8");

describe("system climate and battery controls",()=>{
  it("shows a SALTA-only summer/winter thermostat control",()=>{
    expect(html).toContain('id="climateSummerButton"');
    expect(html).toContain('id="climateWinterButton"');
    expect(html).toContain('id="climateWinterMode"');
    expect(html).toContain("Dieser Schalter wird nicht an HomeKit übergeben");
    expect(script).toContain("api('/api/system/climate-mode'");
    expect(script).toContain("applyClimateMode('summer')");
  });
  it("offers Pushover battery warning settings and seven-day status",()=>{
    expect(html).toContain('data-settings-panel="notifications"');
    expect(html).toContain('id="notificationBatteryThreshold"');
    expect(html).toContain('id="notificationTestButton"');
    expect(script).toContain("api('/api/settings/notifications'");
    expect(script).toContain("api('/api/settings/notifications/test'");
  });
});
