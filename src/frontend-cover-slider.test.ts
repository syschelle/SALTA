import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("window-covering position slider", () => {
  it("renders a 0 to 100 percent slider only for position-capable covers", () => {
    expect(source).toContain("d.type!=='windowCovering'||!d.capabilities.includes('setTargetPosition')");
    expect(source).toContain('type="range" min="0" max="100" step="1"');
    expect(source).toContain("Positionssteuerung ist erst nach der Kalibrierung verfügbar.");
  });

  it("sends setTargetPosition and keeps active slider input stable during live refresh", () => {
    expect(source).toContain("capability:'setTargetPosition',value:position");
    expect(source).toContain("if(!activeCoverSliderId&&!activeBrightnessSliderId)renderDevices()");
    expect(source).toContain("coverSliderDrafts.set(id,position)");
  });

  it("includes discrete open, stop and close controls", () => {
    expect(source).toContain("cmd('${d.id}','open')");
    expect(source).toContain("cmd('${d.id}','stop')");
    expect(source).toContain("cmd('${d.id}','close')");
    expect(styles).toContain(".cover-control");
  });
});
