import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("device configuration details", () => {
  it("uses the wider structured device configuration dialog", () => {
    expect(html).toContain('id="deviceDialog" class="workflow-dialog device-config-dialog"');
    expect(html).toContain('id="deviceDialogStatus"');
    expect(html).toContain('id="deviceDialogMeta"');
    expect(html).toContain('id="deviceInfoGrid"');
    expect(html).toContain("Geräteinformationen");
    expect(styles).toContain("--dialog-device-width:860px");
    expect(styles).toContain(".device-config-dialog{width:min(var(--dialog-device-width),calc(100vw - 28px))}");
  });

  it("renders source-specific technical information without changing device persistence", () => {
    expect(source).toContain("function renderDeviceDialogInfo(d)");
    expect(source).toContain("add('Firmware',d.firmwareVersion)");
    expect(source).toContain("Zuletzt gesehen: ${escapeHtml(deviceInfoTimestamp(selectedDevice.lastSeen))}");
    expect(source).toContain("add('Zuletzt gesehen',deviceInfoTimestamp(d.lastSeen))");
    expect(source).toContain("add('MAC / Geräteadresse',d.macAddress,{copy:true})");
    expect(source).toContain("add('Sensor-Ressourcen',adapter.sensorResourceIds,{copy:true})");
    expect(source).toContain("add('OpenCCU-Kanalname',adapter.channelName)");
    expect(source).toContain("add('Virtueller Typ',adapter.virtualType||d.type)");
    expect(source).toContain("add('SALTA-ID',d.id,{copy:true})");
    expect(source).toContain("openShellyWeb");
  });

  it("numbers only visible configuration sections", () => {
    expect(html.match(/data-device-config-section/g)?.length).toBe(7);
    expect(source).toContain("function renumberDeviceConfigSections()");
    expect(source).toContain("if(section.hidden)return");
  });
  it("prepares per-device HomeKit publication without duplicating SALTA room maintenance", () => {
    expect(html).toContain('id="deviceHomeKitSection"');
    expect(html).toContain('id="deviceHomeKitEnabled"');
    expect(html).toContain('id="deviceHomeKitName"');
    expect(html).toContain('id="deviceHomeKitUseSaltaRoom"');
    expect(html).toContain('id="deviceHomeKitRoom"');
    expect(html).toContain("SALTA-Raum für HomeKit verwenden");
    expect(source).toContain("function homeKitSupportedDevice(d)");
    expect(source).toContain("function syncDeviceHomeKitRoomControls()");
    expect(source).toContain("homekitUseSaltaRoom:useSaltaRoom");
    expect(source).toContain("homekitRoomId:useSaltaRoom?null:");
    expect(styles).toContain(".homekit-compatibility");
  });

});
