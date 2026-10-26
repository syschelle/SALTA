import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const index = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../public/fritzbox-smarthome.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

describe("FRITZ!Box Smart Home frontend", () => {
  it("renders a separate opt-in configuration with every category unchecked by default", () => {
    expect(index).toContain('id="fritzSmartHomeSettingsForm"');
    expect(index).toContain('id="fritzSmartHomeEnabled" type="checkbox"');
    expect(index).toContain('id="fritzSmartHomeThermostats" type="checkbox"');
    expect(index).toContain('id="fritzSmartHomeOutlets" type="checkbox"');
    expect(index).toContain('id="fritzSmartHomeLights" type="checkbox"');
    expect(index).toContain('id="fritzSmartHomeSensors" type="checkbox"');
    expect(index).not.toMatch(/id="fritzSmartHome(?:Enabled|Thermostats|Outlets|Lights|Sensors)"[^>]*checked/);
  });

  it("renders imported FRITZ!Box devices on a dedicated navigation page", () => {
    const hueNav = index.indexOf('href="#hue" data-nav="hue"');
    const fritzNav = index.indexOf('href="#fritzbox" data-nav="fritzbox"');
    const openCcuNav = index.indexOf('href="#openccu" data-nav="openccu"');
    expect(hueNav).toBeGreaterThanOrEqual(0);
    expect(fritzNav).toBeGreaterThan(hueNav);
    expect(openCcuNav).toBeGreaterThan(fritzNav);
    expect(index).toContain('data-page="fritzbox"');
    expect(index).toContain('id="fritzBoxGrid" class="device-groups"');
    expect(index).toContain('id="fritzBoxRoomFilter"');
    expect(index).toContain('id="fritzBoxFilter"');
    expect(app).toContain("'hue','fritzbox','openccu'");
    expect(app).toContain("renderDeviceGrid('fritzbox',fritzBoxGrid,fritzBoxFilter,fritzBoxRoomFilter)");
    expect(app).toContain("api('/api/fritzbox/smarthome/refresh',{method:'POST'})");
    expect(app).toContain("fritzBoxFilter.addEventListener('input',renderDevices)");
  });

  it("uses the authenticated SALTA API instead of embedding FRITZ credentials in the browser", () => {
    expect(source).toContain("api('/api/fritzbox/smarthome')");
    expect(source).toContain("api('/api/fritzbox/smarthome/settings'");
    expect(source).toContain("api('/api/fritzbox/smarthome/test'");
    expect(source).not.toContain('password');
    expect(source).not.toContain('login_sid.lua');
  });
});
