import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionCalls, functionCallsWithStringArgument, functionSource, hasFunction, parseJavaScriptSource } from "../test-utils/source-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const app = parseJavaScriptSource(source);

describe("configurable SALTA appearance", () => {
  it("offers a dedicated appearance settings panel with named profiles", () => {
    expect(html).toContain('data-settings-panel="appearance"');
    expect(html).toContain('data-settings-content="appearance"');
    expect(html).toContain('id="appearanceProfile"');
    for (const profile of ["standard", "ocean", "forest", "warm", "graphite", "custom"]) {
      expect(html).toContain(`value="${profile}"`);
    }
    expect(html).toContain('id="appearanceLightColors"');
    expect(html).toContain('id="appearanceDarkColors"');
  });

  it("exposes every central palette color and keeps light/dark palettes separate", () => {
    expect(source).toContain("['roomBackground','Raumabgrenzung','--overview-room-bg']");
    expect(source).toContain("['stateOnBackground','Gerät AN · Fläche','--state-on-bg']");
    expect(source).toContain("['stateOffBackground','Gerät AUS · Fläche','--state-off-bg']");
    expect(source).toContain("light:{background:'#f4f6f8'");
    expect(source).toContain("dark:{background:'#0d1117'");
    expect(source).toContain("appearanceDraft.profile='custom'");
    expect(styles).toContain("background:var(--overview-room-bg)");
  });

  it("loads, directly previews and persists appearance through the authenticated settings API", () => {
    expect(hasFunction(app, "loadAppearanceSettings")).toBe(true);
    expect(hasFunction(app, "saveAppearanceSettings")).toBe(true);
    expect(hasFunction(app, "applyAppearancePalette")).toBe(true);
    expect(functionCallsWithStringArgument(app, "loadAppearanceSettings", "api", "/api/settings/appearance")).toBe(true);
    expect(functionCallsWithStringArgument(app, "saveAppearanceSettings", "api", "/api/settings/appearance")).toBe(true);
    expect(functionSource(app, "applyAppearancePalette")).toContain("settings=activeAppearanceSettings()");
    expect(functionCalls(app, "previewAppearanceDraft", "applyAppearancePalette", 2)).toBe(true);
  });

  it("applies a selected profile immediately and keeps the apply button as an explicit preview action", () => {
    expect(functionSource(app, "applySelectedAppearanceProfile")).toContain("appearancePreviewData={profile:preset.profile,light:{...preset.light},dark:{...preset.dark}}");
    expect(functionCalls(app, "applySelectedAppearanceProfile", "applyAppearancePalette", 2)).toBe(true);
    expect(source).toContain("appearanceProfile.addEventListener('change',()=>applySelectedAppearanceProfile())");
    expect(source).toContain("appearanceApplyProfileButton.addEventListener('click',()=>applySelectedAppearanceProfile({announce:true}))");
    expect(source).toContain("Farbprofil ${appearanceProfile.options[appearanceProfile.selectedIndex]?.text||profile} als Vorschau angewendet.");
  });

  it("persists appearance in the already backed-up notification state instead of adding schema", () => {
    expect(db).toContain("SELECT details FROM notification_state WHERE key='appearance-settings'");
    expect(db).toContain("VALUES('appearance-settings',$1::jsonb,now())");
    expect(db).not.toContain("CREATE TABLE IF NOT EXISTS appearance");
  });
});
