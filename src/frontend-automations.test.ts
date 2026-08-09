import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const ui = readFileSync(new URL("../public/automation-ui.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("automation frontend", () => {
  it("provides a navigation page with trigger, optional condition and action fields", () => {
    expect(html).toContain('href="#automations" data-nav="automations"');
    expect(html).toContain('data-page="automations"');
    expect(html).toContain('id="automationTriggerDevice"');
    expect(html).toContain('id="automationConditionEnabled"');
    expect(html).toContain('id="automationAction"');
  });

  it("offers on, off and toggle actions and only boolean device states", () => {
    expect(ui).toContain("const automationActionLabels={turnOn:'An',turnOff:'Aus',toggle:'Toggle'}");
    expect(ui).toContain("typeof value==='boolean'");
    expect(ui).toContain("triggerValue:automationElements.triggerValue.value==='true'");
  });

  it("keeps automation cards responsive on mobile", () => {
    expect(styles).toContain('.automation-list{display:grid');
    expect(styles).toContain('@media(max-width:620px){.automation-card');
  });
});
