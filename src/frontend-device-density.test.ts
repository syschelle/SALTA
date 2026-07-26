import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionCalls, hasFunction, parseJavaScriptSource } from "./test-utils/source-inspection.js";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const appAst = parseJavaScriptSource(appSource);

function latestRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...styles.matchAll(new RegExp(`${escaped}\\{([^}]*)\\}`, "g"))];
  return matches.at(-1)?.[1] ?? "";
}

describe("compact responsive device-card layout", () => {
  it("uses dense cards and an adaptive multi-column grid", () => {
    expect(styles).toContain("align-items:start");
    expect(latestRule(".grid")).toContain("repeat(auto-fill,minmax(260px,1fr))");
    expect(latestRule(".device")).toContain("padding:12px");
    expect(latestRule(".device")).toContain("border-radius:13px");
  });

  it("renders values as compact chips and groups interactive controls without repeated margins", () => {
    expect(latestRule(".values")).toContain("display:grid");
    expect(latestRule(".values")).toContain("repeat(auto-fit,minmax(64px,1fr))");
    expect(latestRule(".value")).toContain("background:var(--subtle-bg)");
    expect(latestRule(".device-controls")).toContain("gap:6px");
    expect(hasFunction(appAst, "deviceControls")).toBe(true);
    expect(functionCalls(appAst, "deviceCard", "deviceControls", 1)).toBe(true);
  });

  it("keeps configuration in the header and omits empty action rows for sensor-only devices", () => {
    expect(hasFunction(appAst, "deviceConfigButton")).toBe(true);
    expect(functionCalls(appAst, "deviceCard", "deviceConfigButton", 1)).toBe(true);
    expect(appSource).toContain("${actionMarkup?`<div class=\"actions\">${actionMarkup}</div>`:''}");
    expect(latestRule(".device-config-button")).toContain("width:28px");
    expect(latestRule(".device-config-button")).toContain("height:28px");
  });

  it("uses a single compact card column and two summary columns on phones", () => {
    expect(styles).toContain(".grid,.overview-device-groups .grid{grid-template-columns:1fr;gap:8px}");
    expect(styles).toContain(".stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:22px 0}");
    expect(styles).toContain("main{padding:70px 12px 24px}");
  });
});
