import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const fritz = readFileSync(new URL("../public/fritzbox-smarthome.js", import.meta.url), "utf8");

describe("FRITZ!Box status refresh on Presence page", () => {
  it("refreshes the Smart Home runtime status whenever Presence data is refreshed", () => {
    expect(fritz).toContain("globalThis.refreshFritzBoxSmartHomeStatus=load");
    expect(app).toContain("typeof globalThis.refreshFritzBoxSmartHomeStatus==='function'");
    expect(app).toContain("await globalThis.refreshFritzBoxSmartHomeStatus()");
  });
});
