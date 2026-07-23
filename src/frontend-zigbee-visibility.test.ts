import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("Zigbee device visibility", () => {
  it("hides Shelly-only credentials from Zigbee device dialogs", () => {
    expect(script).toContain("deviceCredentialSection.hidden=!shelly");
    expect(styles).toContain(".form-section[hidden]{display:none}");
  });

  it("allows Zigbee devices to be hidden without removing them", () => {
    expect(html).toContain('id="deviceVisibilitySection"');
    expect(html).toContain('id="deviceHidden"');
    expect(script).toContain("if(selectedDevice.source==='phoscon')config.hidden=deviceHidden.checked");
    expect(script).toContain("d.source==='phoscon'&&Boolean(d.hidden)");
    expect(styles).toContain(".device.hidden-device");
    expect(styles).toContain(".hidden-device-badge");
  });
});
