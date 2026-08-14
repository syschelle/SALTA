import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionCallsWithStringArgument, hasFunction, parseJavaScriptSource } from "../test-utils/source-inspection.js";
import { cssRuleContains } from "../test-utils/style-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const qrScript = readFileSync(new URL("../public/homekit-qr.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const app = parseJavaScriptSource(script, "app.js");
const qr = parseJavaScriptSource(qrScript, "homekit-qr.js");

describe("HomeKit settings frontend", () => {
  it("provides a dedicated HomeKit settings panel with runtime and pairing controls", () => {
    expect(html).toContain('data-settings-panel="homekit"');
    expect(html).toContain('data-settings-content="homekit"');
    for (const id of ["homeKitEnabled", "homeKitName", "homeKitNetworkInterface", "homeKitPairingState", "homeKitPairingQr", "homeKitPairingCode", "homeKitDeviceList", "homeKitDeviceCount", "homeKitResetButton"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('<script src="/homekit-qr.js"></script>');
    expect(hasFunction(qr, "createMatrix")).toBe(true);
    expect(hasFunction(qr, "renderSvg")).toBe(true);
    expect(hasFunction(app, "loadHomeKitSettings")).toBe(true);
    expect(hasFunction(app, "saveHomeKitSettings")).toBe(true);
    expect(hasFunction(app, "resetHomeKitPairing")).toBe(true);
    expect(hasFunction(app, "renderHomeKitDeviceList")).toBe(true);
    expect(hasFunction(app, "setHomeKitDeviceEnabled")).toBe(true);
    expect(functionCallsWithStringArgument(app, "loadHomeKitSettings", "api", "/api/settings/homekit")).toBe(true);
    expect(functionCallsWithStringArgument(app, "saveHomeKitSettings", "api", "/api/settings/homekit")).toBe(true);
    expect(functionCallsWithStringArgument(app, "resetHomeKitPairing", "api", "/api/settings/homekit/reset")).toBe(true);
  });

  it("uses compact sections, a responsive runtime grid and hides pairing after pairing", () => {
    expect(cssRuleContains(styles, ".settings-layout", "grid-template-columns:220px minmax(0,1fr)")).toBe(true);
    expect(cssRuleContains(styles, ".settings-card", "min-width:0")).toBe(true);
    expect(cssRuleContains(styles, ".homekit-section", "border-radius:14px")).toBe(true);
    expect(cssRuleContains(styles, ".homekit-runtime-grid", "grid-template-columns:repeat(5,minmax(0,1fr))")).toBe(true);
    expect(cssRuleContains(styles, ".homekit-pairing-box[hidden]", "display:none")).toBe(true);
    expect(cssRuleContains(styles, ".homekit-pairing-code", "user-select:all")).toBe(true);
    expect(cssRuleContains(styles, ".homekit-pairing-qr", "background:#fff")).toBe(true);
  });

  it("provides a central HomeKit device list with compact publication toggles", () => {
    expect(html).toContain("Geräte in HomeKit");
    expect(html).toContain('class="homekit-info-note"');
    expect(cssRuleContains(styles, ".homekit-device-list", "display:grid")).toBe(true);
    expect(cssRuleContains(styles, ".homekit-device-item", "display:flex")).toBe(true);
    expect(cssRuleContains(styles, ".homekit-device-toggle input:checked+span", "background:var(--accent)")).toBe(true);
  });

  it("does not embed the HomeKit pairing code in static markup", () => {
    expect(html).not.toMatch(/\b\d{3}-\d{2}-\d{3}\b/);
  });
});
