import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cssMediaRuleContains, cssRuleContains } from "../test-utils/style-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("persistent system log frontend", () => {
  it("provides a dedicated log page with filters and clear action", () => {
    expect(html).toContain('href="#logs" data-nav="logs"');
    expect(html).toContain('data-page="logs"');
    expect(html).toContain('id="systemLogList"');
    expect(html).toContain('id="logSourceFilter"');
    expect(html).toContain('id="logLevelFilter"');
    expect(html).toContain('id="systemLogCount"');
    expect(html).toContain('Maximal 100 Einträge, höchstens 30 Tage.');
    expect(script).toContain("api(`/api/logs?${query}`)");
    expect(script).toContain("api('/api/logs',{method:'DELETE'})");
    expect(script).toContain("new URLSearchParams({limit:'100'})");
    expect(script).toContain("<details class=\"system-log-details\">");
    expect(cssRuleContains(styles, ".system-log-entry", "padding:9px 11px")).toBe(true);
    expect(cssRuleContains(styles, ".log-toolbar", "padding:11px 13px")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:760px)", ".log-toolbar", "flex-direction:column")).toBe(true);
  });

  it("keeps detailed OpenCCU errors visible and links them to the log", () => {
    expect(html).toContain('id="openCcuDiagnosticFeedback"');
    expect(html).toContain('href="#logs">Systemprotokoll</a>');
    expect(script).toContain("error.details=payload?.error?.details||{}");
    expect(script).toContain("showOpenCcuError(error)");
  });
});
