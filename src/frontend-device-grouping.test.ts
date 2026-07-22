import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const htmlSource = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("room-grouped device overview", () => {
  it("renders device groups in the order returned by the room API", () => {
    expect(appSource).toContain("const groups=rooms.map(room=>");
    expect(appSource).toContain("name:'Nicht zugeordnet'");
    expect(appSource).toContain('class=\"device-room-group\"');
    expect(htmlSource).toContain('id="deviceGrid" class="device-groups"');
    expect(styles).toContain(".device-groups{display:grid;gap:28px}");
  });

  it("uses an icon-only configure button with an accessible label", () => {
    expect(appSource).toContain('class=\"secondary device-config-button\"');
    expect(appSource).toContain('title=\"Konfigurieren\"');
    expect(appSource).not.toContain('<span>Konfigurieren</span>');
    expect(styles).toContain(".device-config-button{width:32px;height:32px");
  });
});
