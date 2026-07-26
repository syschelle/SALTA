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

  it("styles the compact header row for icon, title and truncated metadata", () => {
    expect(styles).toContain('.device-head{align-items:center;gap:8px}');
    expect(styles).toContain('.device-head-main{align-items:center;gap:8px}');
    expect(styles).toContain('.device h3{font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
    expect(styles).toContain('.meta{font-size:10.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
  });
});
