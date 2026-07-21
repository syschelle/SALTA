import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

describe("device display-name editing", () => {
  it("shows a required display-name field in the shared device dialog", () => {
    expect(html).toContain('id="deviceName"');
    expect(html).toContain('id="deviceName" maxlength="120" required');
  });

  it("loads and saves the name for every device type", () => {
    expect(source).toContain("deviceName.value=selectedDevice.name");
    expect(source).toContain("const name=deviceName.value.trim()");
    expect(source).toContain("JSON.stringify({name,roomId:deviceRoom.value||null})");
  });
});
