import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

describe("Phoscon and Zigbee frontend", () => {
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

  it("provides Phoscon connection and pairing settings", () => {
    expect(html).toContain('data-settings-content="phoscon"');
    expect(html).toContain('id="phosconBaseUrl"');
    expect(html).toContain('id="phosconApiKey"');
    expect(html).toContain('id="phosconPairButton"');
    expect(script).toContain("api('/api/settings/phoscon'");
    expect(script).toContain("api('/api/settings/phoscon/pair'");
    expect(script).toContain("api('/api/adapters/phoscon/reconcile'");
  });
});
