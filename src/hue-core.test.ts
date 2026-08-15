import { describe, expect, it } from "vitest";
import { hexToHueXy, hueApplicationKeyFromPairing, hueBridgeInfo, hueDevicesFromResources, normalizeHueBaseUrl } from "./hue-core.js";

describe("Philips Hue local API core", () => {
  it("normalizes bridge addresses to HTTPS", () => {
    expect(normalizeHueBaseUrl("192.168.178.25")).toBe("https://192.168.178.25");
    expect(normalizeHueBaseUrl("http://hue-bridge.local/")).toBe("https://hue-bridge.local");
    expect(() => normalizeHueBaseUrl("https://user:secret@hue-bridge.local")).toThrow("HUE_URL_INVALID");
    expect(() => normalizeHueBaseUrl("https://hue-bridge.local:8443")).toThrow("HUE_URL_INVALID");
  });

  it("parses the link-button pairing response without exposing unrelated payload fields", () => {
    expect(hueApplicationKeyFromPairing([{ success: { username: "salta-application-key", clientkey: "unused-client-key" } }]))
      .toBe("salta-application-key");
    expect(() => hueApplicationKeyFromPairing([{ error: { type: 101, description: "link button not pressed" } }]))
      .toThrow("HUE_LINK_BUTTON_REQUIRED");
  });

  it("maps bridge metadata from the authenticated configuration response", () => {
    expect(hueBridgeInfo({ name: "Hue Bridge", bridgeid: "001788FFFE123456", modelid: "BSB002", swversion: "1972004020", apiversion: "1.70.0" }))
      .toMatchObject({ connected: true, name: "Hue Bridge", bridgeId: "001788FFFE123456", model: "BSB002", softwareVersion: "1972004020", apiVersion: "1.70.0" });
  });

  it("maps v2 light resources with brightness, color temperature and color capabilities", () => {
    const payload = {
      data: [
        {
          id: "owner-1",
          type: "device",
          metadata: { name: "Wohnzimmer", archetype: "sultan_bulb" },
          product_data: { model_id: "LCT010", product_name: "Hue color lamp", product_archetype: "sultan_bulb" },
          software_version: "1.122.2"
        },
        { id: "connectivity-1", type: "zigbee_connectivity", owner: { rid: "owner-1", rtype: "device" }, status: "connected" },
        {
          id: "light-1",
          type: "light",
          owner: { rid: "owner-1", rtype: "device" },
          on: { on: true },
          dimming: { brightness: 42.5 },
          color_temperature: { mirek: 250, mirek_valid: true, mirek_schema: { mirek_minimum: 153, mirek_maximum: 454 } },
          color: { xy: { x: 0.3127, y: 0.329 } }
        }
      ]
    };

    const [device] = hueDevicesFromResources("https://192.168.178.25", "001788FFFE123456", payload);
    expect(device).toMatchObject({
      id: "hue:001788FFFE123456:light:light-1",
      source: "hue",
      sourceId: "light:light-1",
      type: "light",
      name: "Wohnzimmer",
      reachable: true,
      homekitEnabled: false,
      state: { on: true, brightness: 42.5, colorTemperature: 250, colorTemperatureKelvin: 4000 },
      adapterData: { hueResourceId: "light-1", hueOwnerDeviceId: "owner-1", colorTemperatureMinMirek: 153, colorTemperatureMaxMirek: 454 }
    });
    expect(device?.capabilities).toEqual(expect.arrayContaining(["turnOn", "turnOff", "toggle", "setBrightness", "setColorTemperature", "setColor"]));
  });

  it("maps Hue smart plugs as outlets and preserves disconnected reachability", () => {
    const payload = {
      data: [
        { id: "owner-plug", type: "device", metadata: { name: "Steckdose", archetype: "plug" }, product_data: { model_id: "LOM001", product_name: "Hue smart plug" } },
        { id: "conn-plug", type: "zigbee_connectivity", owner: { rid: "owner-plug" }, status: "disconnected" },
        { id: "light-plug", type: "light", owner: { rid: "owner-plug" }, on: { on: false } }
      ]
    };
    const [device] = hueDevicesFromResources("https://hue.local", "001788FFFE123456", payload);
    expect(device).toMatchObject({ type: "outlet", reachable: false, state: { on: false } });
    expect(device?.capabilities).toEqual(["turnOn", "turnOff", "toggle"]);
  });

  it("converts HTML colors to bounded Hue xy coordinates", () => {
    const xy = hexToHueXy("#ff0000");
    expect(xy.x).toBeGreaterThan(0.6);
    expect(xy.y).toBeGreaterThan(0.2);
    expect(() => hexToHueXy("not-a-color")).toThrow("INVALID_COLOR");
  });
});
