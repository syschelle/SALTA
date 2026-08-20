import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionSource, hasFunction, parseJavaScriptSource } from "../test-utils/source-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const sourceFile = parseJavaScriptSource(script);

describe("deCONZ and Zigbee frontend", () => {
  it("separates Shelly and Zigbee navigation and device grids", () => {
    expect(html).toContain('href="#shelly" data-nav="shelly"');
    expect(html).toContain('href="#zigbee" data-nav="zigbee"');
    expect(html).toContain('data-page="shelly"');
    expect(html).toContain('data-page="zigbee"');
    expect(html).toContain('id="deviceGrid" class="device-groups"');
    expect(html).toContain('id="zigbeeGrid" class="device-groups"');
    expect(script).toContain("renderDeviceGrid('shelly',deviceGrid,filter,roomFilter)");
    expect(script).toContain("renderDeviceGrid('phoscon',zigbeeGrid,zigbeeFilter,zigbeeRoomFilter)");
  });

  it("provides deCONZ connection, pairing and direct UI access settings", () => {
    expect(html).toContain('data-settings-content="phoscon"');
    expect(html).toContain('id="phosconBaseUrl"');
    expect(html).toContain('id="phosconApiKey"');
    expect(html).toContain('id="phosconPairButton"');
    expect(html).toContain('data-settings-panel="phoscon" onclick="showSettingsPanel(\'phoscon\')">deCONZ</button>');
    expect(html).toContain('<h2>deCONZ-Instanz</h2>');
    expect(html).toContain('>deCONZ-Adresse<input id="phosconBaseUrl"');
    expect(html).toContain('id="deconzUiLink"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer" hidden');
    expect(html).toContain('deCONZ-Oberfläche öffnen</a>');
    expect(hasFunction(sourceFile, "deconzUiUrl")).toBe(true);
    const deconzUiUrlSource = functionSource(sourceFile, "deconzUiUrl");
    expect(deconzUiUrlSource).toContain("new URL");
    expect(deconzUiUrlSource).toContain("http:");
    expect(deconzUiUrlSource).toContain("https:");
    expect(script).toContain("deconzUiLink.href=href");
    expect(script).toContain("phosconBaseUrl.addEventListener('input',updateDeconzUiLink)");
    expect(script).toContain("api('/api/settings/phoscon'");
    expect(script).toContain("api('/api/settings/phoscon/pair'");
    expect(script).toContain("api('/api/adapters/phoscon/reconcile'");
  });
  it("formats the deCONZ daylight sensor for the Zigbee device view", () => {
    expect(script).toContain("sunrise:'Sonnenaufgang'");
    expect(script).toContain("sunset:'Sonnenuntergang'");
    expect(script).toContain("daylightStatus:'Sonnenphase'");
    expect(script).toContain("170:'Sonnenhöchststand'");
    expect(script).toContain("daylightTimeLabel");
    expect(script).toContain("split(' + ').includes('Daylight')?5:4");
  });

});
