import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const homekit = readFileSync(new URL("./homekit.ts", import.meta.url), "utf8");

describe("virtual device frontend", () => {
  it("adds the virtual-device navigation directly after HomeMatic", () => {
    expect(html.indexOf('data-nav="virtual"')).toBeGreaterThan(html.indexOf('data-nav="openccu"'));
    expect(html).toContain('data-page="virtual"');
    expect(html).toContain('id="addVirtualDeviceDialog"');
  });

  it("renders and creates virtual switches through the shared device UI", () => {
    expect(app).toContain("renderDeviceGrid('virtual',virtualGrid,virtualFilter,virtualRoomFilter)");
    expect(app).toContain("api('/api/adapters/virtual/devices'");
    expect(app).toContain("virtual:'Virtuell'");
  });

  it("routes HomeKit writes through the shared command dispatcher", () => {
    expect(homekit).toContain("private commander:");
    expect(homekit).toContain("this.commander.command({deviceId:d.id");
  });
});
