import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionSource, hasFunction, parseJavaScriptSource } from "../test-utils/source-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const app = parseJavaScriptSource(source);

describe("Philips Hue frontend", () => {
  it("provides a dedicated Hue navigation page parallel to Zigbee", () => {
    expect(html).toContain('href="#hue" data-nav="hue"');
    expect(html).toContain('data-page="hue"');
    expect(html).toContain('id="hueGrid" class="device-groups"');
    expect(source).toContain("renderDeviceGrid('hue',hueGrid,hueFilter,hueRoomFilter)");
  });

  it("provides local bridge pairing, status and disconnect controls", () => {
    for (const id of ["hueForm", "hueBaseUrl", "hueDiscoverButton", "hueDiscoveryResults", "hueApplicationKey", "huePairButton", "hueGatewayStatus", "hueDisconnectButton"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(hasFunction(app, "discoverHue")).toBe(true);
    expect(hasFunction(app, "pairHue")).toBe(true);
    expect(hasFunction(app, "saveHue")).toBe(true);
    expect(hasFunction(app, "disconnectHue")).toBe(true);
    expect(functionSource(app, "discoverHue")).toContain("/api/settings/hue/discover");
    expect(functionSource(app, "pairHue")).toContain("/api/settings/hue/pair");
    expect(functionSource(app, "reconcileHue")).toContain("/api/adapters/hue/reconcile");
  });

  it("adds Hue brightness, color-temperature and color controls only when capabilities advertise them", () => {
    expect(hasFunction(app, "hueColorTemperatureControl")).toBe(true);
    expect(hasFunction(app, "hueColorControl")).toBe(true);
    expect(functionSource(app, "hueColorTemperatureControl")).toContain("setColorTemperature");
    expect(functionSource(app, "hueColorControl")).toContain("setColor");
    expect(functionSource(app, "deviceControls")).toContain("hueColorTemperatureControl");
    expect(functionSource(app, "deviceControls")).toContain("hueColorControl");
  });

  it("keeps newly discovered Hue devices out of SALTA HomeKit by default", () => {
    expect(html).toContain("Hue-Geräte werden standardmäßig nicht erneut an HomeKit veröffentlicht");
    expect(source).toContain("sourceLabels={shelly:'Shelly',phoscon:'Zigbee',hue:'Philips Hue'");
  });
});
