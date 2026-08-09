import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const automationUi = readFileSync(new URL("../public/automation-ui.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("presence page", () => {
  it("has its own navigation entry and keeps all presence configuration on one page", () => {
    expect(html).toContain('data-nav="presence"');
    expect(html).toContain('data-page="presence"');
    expect(html).toContain('id="presenceSettingsForm"');
    expect(html).toContain('id="presenceHouseSummary"');
    expect(html).toContain('id="presenceTargetList"');
    expect(html).toContain('id="presenceTargetForm"');
    expect(html).toContain('id="presenceProtocol"');
    expect(html).toContain('id="presenceHost"');
    expect(html).toContain('id="presencePort"');
    expect(html).toContain('id="presenceTlsInsecure"');
    expect(html).toContain('class="presence-connection-status-row"');
    expect(html).toContain('class="presence-endpoint-group"');
    expect(html).toContain('class="presence-transport-options"');
  });
  it("loads, tests, refreshes and edits presence targets through the presence API", () => {
    expect(app).toContain("async function loadPresence({applySettings=true}={})");
    expect(app).toContain("'/api/presence/test'");
    expect(app).toContain("'/api/presence/refresh'");
    expect(app).toContain("'/api/presence/devices'");
    expect(app).toContain("presenceTargetDelay");
    expect(app).toContain("presenceBaseUrlFromForm()");
    expect(app).toContain("tlsInsecure:presenceProtocol.value==='https'&&presenceTlsInsecure.checked");
    expect(app).toContain("FRITZBOX_TLS_CERTIFICATE");
    expect(app).toContain("FRITZ!Box erreichbar");
    expect(app).toContain("Verbindung noch nicht geprüft");
    expect(app).toContain("lastTestSuccess");
    expect(app).toContain("loadPresence({applySettings:false})");
  });
  it("exposes individual and house presence booleans to the generic automation editor", () => {
    expect(automationUi).toContain("'present'");
    expect(automationUi).toContain("'anyHome'");
    expect(automationUi).toContain("'nobodyHome'");
    expect(automationUi).toContain("present:['Anwesend','Abwesend']");
    expect(automationUi).toContain("anyHome:['Jemand zuhause','Niemand zuhause']");
  });
  it("has responsive styles for the combined page", () => {
    expect(styles).toContain(".presence-top-grid");
    expect(styles).toContain(".presence-devices-layout");
    expect(styles).toContain(".presence-target-card.present");
    expect(styles).toContain(".presence-connection-status-row");
    expect(styles).toContain(".presence-endpoint-group");
    expect(styles).toContain(".presence-transport-options");
    expect(styles).toContain(".gateway-status.failed");
  });
});
