import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionCalls, functionSource, hasFunction, parseJavaScriptSource } from "./test-utils/source-inspection.js";
import { cssRuleContains } from "./test-utils/style-inspection.js";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const appAst = parseJavaScriptSource(appSource);

describe("Shelly device web shortcut", () => {
  it("renders the shortcut next to configuration through the shared device card", () => {
    expect(hasFunction(appAst, "deviceShellyWebButton")).toBe(true);
    expect(functionCalls(appAst, "deviceCard", "deviceShellyWebButton", 1)).toBe(true);
    expect(appSource).toContain('title="Shelly-Weboberfläche öffnen"');
    expect(appSource).toContain("iconMarkup('open-in-new')");
  });

  it("only creates a web URL for Shelly devices with a valid HTTP(S) address", () => {
    const source = functionSource(appAst, "shellyWebUrl");
    expect(source).toContain("d?.source!=='shelly'");
    expect(source).toContain("['http:','https:'].includes(url.protocol)");
    expect(source).toContain("url.username||url.password");
  });

  it("opens the Shelly page in a separate tab without opener access", () => {
    const source = functionSource(appAst, "openShellyWeb");
    expect(source).toContain("window.open(url,'_blank','noopener,noreferrer')");
    expect(source).toContain("opened.opener=null");
  });

  it("keeps the shortcut as compact as the configuration button", () => {
    expect(cssRuleContains(styles, ".device-web-button", "width:28px")).toBe(true);
    expect(cssRuleContains(styles, ".device-web-button", "height:28px")).toBe(true);
  });
});
