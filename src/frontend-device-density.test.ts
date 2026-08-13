import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionCalls, hasFunction, parseJavaScriptSource } from "../test-utils/source-inspection.js";
import { cssRuleContains } from "../test-utils/style-inspection.js";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const appAst = parseJavaScriptSource(appSource);

describe("compact responsive device-card layout", () => {
  it("uses dense cards and an adaptive multi-column grid", () => {
    expect(styles).toContain("align-items:start");
    expect(cssRuleContains(styles, ".grid", "grid-template-columns:repeat(auto-fill,minmax(260px,1fr))")).toBe(true);
    expect(cssRuleContains(styles, ".device", "padding:12px")).toBe(true);
    expect(cssRuleContains(styles, ".device", "border-radius:13px")).toBe(true);
  });

  it("renders values as compact chips and groups interactive controls without repeated margins", () => {
    expect(cssRuleContains(styles, ".values", "display:grid")).toBe(true);
    expect(cssRuleContains(styles, ".values", "grid-template-columns:repeat(auto-fit,minmax(64px,1fr))")).toBe(true);
    expect(cssRuleContains(styles, ".value", "background:var(--subtle-bg)")).toBe(true);
    expect(cssRuleContains(styles, ".device-controls", "gap:6px")).toBe(true);
    expect(hasFunction(appAst, "deviceControls")).toBe(true);
    expect(functionCalls(appAst, "deviceCard", "deviceControls", 1)).toBe(true);
  });

  it("keeps configuration in the header and omits empty action rows for sensor-only devices", () => {
    expect(hasFunction(appAst, "deviceConfigButton")).toBe(true);
    expect(functionCalls(appAst, "deviceCard", "deviceConfigButton", 1)).toBe(true);
    expect(appSource).toContain("${actionMarkup?`<div class=\"actions\">${actionMarkup}</div>`:''}");
    expect(cssRuleContains(styles, ".device-config-button", "width:28px")).toBe(true);
    expect(cssRuleContains(styles, ".device-config-button", "height:28px")).toBe(true);
  });

  it("uses a single compact card column and two summary columns on phones", () => {
    expect(styles).toContain(".grid,.overview-device-groups .grid{grid-template-columns:1fr;gap:8px}");
    expect(styles).toContain(".stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:22px 0}");
    expect(styles).toContain("main{padding:70px 12px 24px}");
  });
});
