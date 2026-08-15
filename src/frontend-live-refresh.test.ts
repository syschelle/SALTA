import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionCalls, functionSource, parseJavaScriptSource } from "../test-utils/source-inspection.js";

const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const app = parseJavaScriptSource(script, "app.js");

describe("route-aware live refresh", () => {
  it("pauses the periodic device refresh while editing automations or settings", () => {
    const routeGuard = functionSource(app, "liveRefreshAllowedForRoute");
    expect(routeGuard).toContain("route!=='automations'");
    expect(routeGuard).toContain("route!=='settings'");
    expect(functionCalls(app, "refreshLiveData", "liveRefreshAllowedForRoute", 1)).toBe(true);
  });

  it("does not reload automations from the five-second live refresh", () => {
    const refresh = functionSource(app, "refreshLiveData");
    expect(refresh).not.toContain("loadAutomations(");
    expect(refresh).toContain("routeFromHash()==='presence'");
  });

  it("keeps the five-second refresh available for live device pages", () => {
    expect(script).toContain("setInterval(refreshLiveData,5000)");
  });
});
