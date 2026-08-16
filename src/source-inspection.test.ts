import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionTransitivelyCalls, parseJavaScriptSource } from "../test-utils/source-inspection.js";

describe("source inspection call graph", () => {
  it("follows composed renderer helpers instead of requiring a direct call", () => {
    const source = parseJavaScriptSource(`
      function deviceCard(device) { return deviceControls(device); }
      function deviceControls(device) { return targetTemperatureControl(device, "overview"); }
      function targetTemperatureControl(device, instance) { return String(device.id) + instance; }
    `);

    expect(functionTransitivelyCalls(source, "deviceCard", "targetTemperatureControl", 1)).toBe(true);
    expect(functionTransitivelyCalls(source, "deviceCard", "targetTemperatureControl", 3)).toBe(false);
  });

  it("terminates safely when helper functions form a cycle", () => {
    const source = parseJavaScriptSource(`
      function first() { return second(); }
      function second() { return first(); }
      function target() { return true; }
    `);

    expect(functionTransitivelyCalls(source, "first", "target")).toBe(false);
  });
  it("wires the vacation mode API and security manager", () => {
    const serverSource = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
    const mainSource = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
    expect(serverSource).toContain('/api/system/vacation-mode');
    expect(serverSource).toContain('vacationMode.setEnabled');
    expect(mainSource).toContain('new VacationModeManager(registry, config.TZ)');
    expect(mainSource).toContain('await vacation.initialize()');
    expect(mainSource).toContain('vacation.start()');
  });

});
