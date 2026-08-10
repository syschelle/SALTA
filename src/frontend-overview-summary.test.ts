import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionSource, parseJavaScriptSource } from "./test-utils/source-inspection.js";
import { cssMediaRuleContains, cssRuleContains } from "./test-utils/style-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const appAst = parseJavaScriptSource(appSource);

describe("compact overview summary", () => {
  it("uses a dedicated compact overview header and five summary cards", () => {
    expect(html).toContain('class="overview-header"');
    expect(html).toContain('class="stats overview-stats"');
    expect(html).toContain('id="overviewPresenceCard"');
    expect(html).toContain('id="overviewPresence"');
    expect(html).toContain('id="overviewPresenceDetail"');
    expect(cssRuleContains(styles, ".overview-stats", "grid-template-columns:repeat(5,minmax(0,1fr))")).toBe(true);
    expect(cssRuleContains(styles, ".overview-stats", "margin:18px 0 18px")).toBe(true);
    expect(cssRuleContains(styles, ".overview-heading h1", "font-size:28px")).toBe(true);
    expect(cssRuleContains(styles, ".overview-stats article", "min-height:78px")).toBe(true);
  });

  it("renders house presence from the existing virtual presence-group device", () => {
    const summary = functionSource(appAst, "updateDashboardSummary");
    expect(summary).toContain("device.id==='presence:house'");
    expect(summary).toContain("device.profile==='presence-group'");
    expect(summary).toContain("housePresence.state?.presentCount");
    expect(summary).toContain("housePresence.adapterData?.memberCount");
    expect(summary).toContain("presenceValue.textContent=anyHome?'Zuhause':'Niemand'");
    expect(summary).toContain("`${count} von ${members} anwesend`");
  });

  it("keeps presence devices out of normal device/reachability/power counters", () => {
    const summary = functionSource(appAst, "updateDashboardSummary");
    expect(summary).toContain("all.filter(device=>device.source!=='presence')");
  });

  it("keeps the overview summary compact and responsive on narrow screens", () => {
    expect(cssMediaRuleContains(styles, "(max-width:700px)", ".overview-stats", "grid-template-columns:repeat(2,minmax(0,1fr))")).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:700px)", ".overview-presence-stat", "grid-column:span 2")).toBe(true);
  });
});
