import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionCalls, hasFunction, parseJavaScriptSource } from "./test-utils/source-inspection.js";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const htmlSource = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const appAst = parseJavaScriptSource(appSource);

describe("room-grouped device overview", () => {
  it("renders device groups in the order returned by the room API", () => {
    expect(appSource).toContain("const groups=rooms.map(room=>");
    expect(appSource).toContain("name:'Nicht zugeordnet'");
    expect(appSource).toContain('class=\"device-room-group\"');
    expect(htmlSource).toContain('id="deviceGrid" class="device-groups"');
    expect(styles).toContain(".device-groups{display:grid;gap:28px}");
  });

  it("shows all room-assigned devices on the overview and removes the old status panel", () => {
    expect(htmlSource).toContain('id="overviewDeviceGrid" class="device-groups overview-device-groups"');
    expect(htmlSource).toContain("Alle einem Raum zugeordneten Shelly-, Zigbee- und HomeMatic-Geräte.");
    expect(htmlSource).not.toContain("Alles an einem Ort");
    expect(htmlSource).not.toContain('<p class="eyebrow">STATUS</p>');
    expect(hasFunction(appAst, "renderOverviewDevices")).toBe(true);
    expect(appSource).toContain("roomGrouping.groupAssignedDevicesByRoom(rooms,all)");
    expect(appSource).toContain("overviewDeviceGridElement.innerHTML=groups.map(group=>deviceRoomGroup(group,true,'overview')).join('')");
    expect(functionCalls(appAst, "renderDevices", "renderOverviewDevices")).toBe(true);
    expect(htmlSource).toContain('<script src="/room-grouping.js"></script>');
    expect(appSource).toContain("Auf der Übersicht werden ausschließlich Geräte mit einer gültigen Raumzuordnung angezeigt.");
    expect(appSource).toContain("const controlId=`brightness-${d.id}${instance?`-${instance}`:''}`");
    expect(appSource).toContain("const controlId=`target-temperature-${d.id}${instance?`-${instance}`:''}`");
    expect(appSource).toContain("const controlId=`cover-position-${d.id}${instance?`-${instance}`:''}`");
    expect(appSource).toContain("const sourceLabels={shelly:'Shelly',phoscon:'Zigbee',openccu:'HomeMatic'}");
    expect(styles).toContain(".overview-section-head{margin-top:0}");
  });

  it("uses an icon-only configure button with an accessible label", () => {
    expect(appSource).toContain('class=\"secondary device-config-button\"');
    expect(appSource).toContain('title=\"Konfigurieren\"');
    expect(appSource).not.toContain('<span>Konfigurieren</span>');
    expect(styles).toContain(".device-config-button{width:32px;height:32px");
  });
});
