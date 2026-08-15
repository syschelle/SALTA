import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionSource, parseJavaScriptSource } from "../test-utils/source-inspection.js";

const source = readFileSync(new URL("../public/automation-ui.js", import.meta.url), "utf8");
const parsed = parseJavaScriptSource(source, "automation-ui.js");

function actionResolver(devices: unknown[]): (deviceId: string) => string[] {
  const deviceLookup = functionSource(parsed, "automationDeviceById");
  const actionsForDevice = functionSource(parsed, "automationActionsForDevice");
  return new Function("all", `${deviceLookup}\n${actionsForDevice}\nreturn automationActionsForDevice;`)(devices) as (deviceId: string) => string[];
}

describe("automation target catalog", () => {
  it("keeps legacy persisted virtual devices selectable as binary targets", () => {
    const actions = actionResolver([{
      id: "virtual:legacy", source: "virtual", type: "legacyVirtual", presentationType: "auto",
      state: {}, capabilities: [], adapterData: {}, name: "Legacy virtual"
    }]);

    expect(actions("virtual:legacy")).toEqual(["turnOn", "turnOff", "toggle"]);
  });

  it("does not turn an unrelated read-only OpenCCU contact into a target", () => {
    const actions = actionResolver([{
      id: "openccu:contact", source: "openccu", type: "contactSensor",
      state: { open: false }, capabilities: [], adapterData: {}, name: "Window"
    }]);

    expect(actions("openccu:contact")).toEqual([]);
  });
});
