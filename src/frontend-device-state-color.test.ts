import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("switch, light and outlet card state colors", () => {
  it("adds on/off card classes only to reachable switches, lights and outlets", () => {
    expect(appSource).toContain("const stateVisual=['switch','light','outlet'].includes(visualType)");
    expect(appSource).toContain("const stateClass=stateKnown?(d.state.on?' device-state-on':' device-state-off')");
  });

  it("removes the redundant status metric from colored cards", () => {
    expect(appSource).toContain("displayedState(d).filter(([key])=>!(stateVisual&&key==='on'))");
  });

  it("provides distinct light and dark theme colors", () => {
    expect(styles).toContain(".device.device-state-on{background:var(--state-on-bg)");
    expect(styles).toContain(".device.device-state-off{background:var(--state-off-bg)");
    expect(styles).toContain('html[data-theme="dark"]{--state-on-bg:');
  });
});
