import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  functionCalls,
  functionSource,
  hasFunction,
  objectLiteralPropertyNames,
  parseJavaScriptSource,
} from "../test-utils/source-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const app = parseJavaScriptSource(source);

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

  it("keeps name, room, presentation and HomeKit fields in one shared save contract", () => {
    expect(html).toContain('id="deviceName" maxlength="120" required');
    expect(html).toContain('id="deviceFavorite" type="checkbox"');
    expect(html).toContain('id="devicePresentationType"');
    for (const value of ["auto", "light", "switch", "outlet", "fan"]) {
      expect(html).toContain(`option value="${value}"`);
    }
    expect(hasFunction(app, "openDevice")).toBe(true);
    expect(functionSource(app, "openDevice")).toContain("deviceName.value=selectedDevice.name");
    expect(functionSource(app, "openDevice")).toContain("deviceFavorite.checked=Boolean(selectedDevice.favorite)");
    expect(functionSource(app, "saveDeviceConfig")).toContain("deviceName.value.trim()");
    expect(functionCalls(app, "saveDeviceConfig", "api", 2)).toBe(true);
    expect(objectLiteralPropertyNames(app, "saveDeviceConfig", "config")).toEqual(expect.arrayContaining([
      "name", "roomId", "favorite", "presentationType", "homekitEnabled", "homekitName", "homekitUseSaltaRoom", "homekitRoomId",
    ]));
    expect(hasFunction(app, "resolvedPresentationType")).toBe(true);
    expect(source).toContain("fan:'Ventilator'");
  });

  it("renders source-specific technical information", () => {
    expect(hasFunction(app, "renderDeviceDialogInfo")).toBe(true);
    const infoRenderer = functionSource(app, "renderDeviceDialogInfo");
    for (const label of ["Firmware", "Zuletzt gesehen", "MAC / Geräteadresse", "Sensor-Ressourcen", "OpenCCU-Kanalname", "Virtueller Typ", "SALTA-ID"]) {
      expect(infoRenderer).toContain(label);
    }
    expect(source).toContain("openShellyWeb");
  });

  it("numbers only visible configuration sections", () => {
    expect(html).toContain('id="deviceVirtualTypeSection" class="form-section device-config-section" data-device-config-section hidden');
    expect(hasFunction(app, "renumberDeviceConfigSections")).toBe(true);
    const renumber = functionSource(app, "renumberDeviceConfigSections");
    expect(renumber).toContain("querySelectorAll('[data-device-config-section]')");
    expect(renumber).toContain("section.hidden");
  });

  it("prepares per-device HomeKit publication without duplicating SALTA room maintenance", () => {
    for (const id of ["deviceHomeKitSection", "deviceHomeKitEnabled", "deviceHomeKitName", "deviceHomeKitUseSaltaRoom", "deviceHomeKitRoom"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("SALTA-Raum für HomeKit verwenden");
    expect(hasFunction(app, "homeKitSupportedDevice")).toBe(true);
    expect(hasFunction(app, "syncDeviceHomeKitRoomControls")).toBe(true);
    expect(styles).toContain(".homekit-compatibility");
  });
});
