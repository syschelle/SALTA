import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adapter = readFileSync(new URL("./phoscon-adapter.ts", import.meta.url), "utf8");
const registry = readFileSync(new URL("./registry.ts", import.meta.url), "utf8");

describe("Phoscon realtime button events", () => {
  it("keeps a reconnecting deCONZ websocket and emits every buttonevent", () => {
    expect(adapter).toContain("new WebSocket(target)");
    expect(adapter).toContain('event.resource !== "sensors"');
    expect(adapter).toContain('typeof statePatch.buttonEvent === "number"');
    expect(adapter).toContain("this.registry.emitDeviceEvent({");
    expect(adapter).toContain('key: "buttonEvent"');
    expect(adapter).toContain("this.scheduleReconnect(generation)");
  });

  it("provides a dedicated registry event channel separate from state updates", () => {
    expect(registry).toContain('this.listeners("deviceEvent")');
    expect(registry).toContain('event: "deviceEvent"');
  });
});
