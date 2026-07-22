import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("compact device title layout", () => {
  it("renders the device name beside the icon in a shared header row", () => {
    expect(appSource).toContain('class="device-head"');
    expect(appSource).toContain('class="device-head-main"');
    expect(appSource).toContain('class="device-title-block"');
  });

  it("styles the compact header row for icon, title and meta data", () => {
    expect(styles).toContain('.device-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}');
    expect(styles).toContain('.device-head-main{display:flex;align-items:flex-start;gap:10px;min-width:0;flex:1}');
    expect(styles).toContain('.device h3{margin:0;line-height:1.25}');
  });
});
