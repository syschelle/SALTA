import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const databaseSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

describe("Philips Hue persistence and wiring", () => {
  it("reuses encrypted adapter settings instead of adding a parallel secrets table", () => {
    for (const symbol of ["getHueSettings", "getHueConnection", "updateHueSettings", "clearHueSettings"]) expect(databaseSource).toContain(`function ${symbol}`);
    expect(databaseSource).toContain("adapter_id='hue'");
    expect(databaseSource).toContain("encryptSecret(applicationKey)");
  });

  it("wires Hue into the central command router and lifecycle", () => {
    expect(mainSource).toContain("new HueAdapter(registry)");
    expect(mainSource).toContain("{ shelly, phoscon, hue, openccu: openCcu, virtual }");
    expect(mainSource).toContain("hue.start()");
    expect(mainSource).toContain("hue.stop()");
  });

  it("exposes authenticated settings, pairing and reconcile endpoints", () => {
    for (const route of ["/api/settings/hue", "/api/settings/hue/discover", "/api/settings/hue/pair", "/api/adapters/hue/reconcile"]) expect(serverSource).toContain(route);
    expect(serverSource).toContain("hueCredential");
    expect(serverSource).not.toContain("applicationKey, requestId");
  });
});
