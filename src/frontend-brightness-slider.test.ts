import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("dimmable light control", () => {
  it("renders and submits a 0–100 percent brightness slider", () => {
    expect(source).toContain("d.capabilities.includes('setBrightness')");
    expect(source).toContain('type="range" min="0" max="100" step="1"');
    expect(source).toContain("await cmd(id,'setBrightness'");
    expect(source).toContain("activeBrightnessSliderId");
    expect(styles).toContain(".brightness-control{");
  });
});
