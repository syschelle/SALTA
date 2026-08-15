import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionSource, hasFunction, parseJavaScriptSource } from "../test-utils/source-inspection.js";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const app = parseJavaScriptSource(appSource);

describe("switch, light and outlet card state colors", () => {
  it("adds on/off card classes only to reachable persistent switch-style cards", () => {
    expect(hasFunction(app, "deviceCard")).toBe(true);
    const card = functionSource(app, "deviceCard");
    expect(card).toContain("const virtualButton=isVirtualButton(d)");
    expect(card).toContain("!virtualButton&&['switch','light','outlet'].includes(visualType)");
    expect(card).toContain("stateVisual&&d.reachable&&typeof d.state?.on==='boolean'");
    expect(card).toContain("device-state-on");
    expect(card).toContain("device-state-off");
  });

  it("removes the redundant status metric from persistent colored cards and momentary buttons", () => {
    const card = functionSource(app, "deviceCard");
    expect(card).toContain("displayedState(d).filter");
    expect(card).toContain("(stateVisual||virtualButton)&&key==='on'");
  });

  it("provides distinct light and dark theme colors", () => {
    expect(styles).toContain(".device.device-state-on{background:var(--state-on-bg)");
    expect(styles).toContain(".device.device-state-off{background:var(--state-off-bg)");
    expect(styles).toContain('html[data-theme="dark"]{--state-on-bg:');
  });
});
