import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const loginHtml = readFileSync(new URL("../public/login.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const automationUi = readFileSync(new URL("../public/automation-ui.js", import.meta.url), "utf8");
const i18n = readFileSync(new URL("../public/i18n.js", import.meta.url), "utf8");
const de = JSON.parse(readFileSync(new URL("../public/i18n/de.json", import.meta.url), "utf8"));
const en = JSON.parse(readFileSync(new URL("../public/i18n/en.json", import.meta.url), "utf8"));
const server = readFileSync(new URL("server.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

function countKeys(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.values(value as Record<string, unknown>).reduce((sum, entry) => sum + (entry && typeof entry === "object" && !Array.isArray(entry) ? countKeys(entry) : 1), 0);
}

describe("browser-localized SALTA UI", () => {
  it("loads the localization layer and provides per-browser language controls", () => {
    expect(html).toContain('<script src="/i18n.js"></script>');
    expect(html.indexOf('<script src="/i18n.js"></script>')).toBeLessThan(html.indexOf('<script src="/app.js"></script>'));
    expect(loginHtml).toContain('<script src="/i18n.js"></script>');
    expect(html).toContain('id="languageSelector"');
    expect(html).toContain('id="appearanceLanguage"');
    expect(loginHtml).toContain('id="loginLanguage"');
    expect(i18n).toContain("const COOKIE='salta_language'");
    expect(i18n).toContain("new Set(['auto','de','en'])");
    expect(i18n).toContain("navigator.languages");
    expect(i18n).toContain("document.documentElement.lang=active");
    expect(i18n).not.toContain("localStorage");
  });

  it("keeps German and English translations in external JSON dictionaries", () => {
    expect(de.meta.language).toBe("de");
    expect(en.meta.language).toBe("en");
    expect(en.phrases["Übersicht"]).toBe("Overview");
    expect(en.phrases["Geräte nach Räumen"]).toBe("Devices by room");
    expect(en.phrases["Urlaubsmodus"]).toBe("Vacation mode");
    expect(en.phrases["Automationen"]).toBe("Automations");
    expect(en.phrases["Darstellung"]).toBe("Appearance");
    expect(Object.keys(en.phrases).length).toBeGreaterThanOrEqual(450);
    expect(countKeys(en.language)).toBe(countKeys(de.language));
  });

  it("translates static and dynamically inserted UI while protecting user-defined names", () => {
    expect(i18n).toContain("MutationObserver");
    expect(i18n).toContain("translateSubtree(document.documentElement)");
    expect(i18n).toContain(".device h3");
    expect(i18n).toContain(".device-room-title h2");
    expect(i18n).toContain(".presence-target-title h3");
    expect(i18n).toContain(".homekit-device-title strong");
    expect(i18n).toContain(".automation-card-title h3");
    expect(en.patterns.some((entry: { match: string }) => entry.match === "^Wenn (.+)$")).toBe(true);
    expect(en.tokens[" ODER "]).toBe(" OR ");
    expect(en.tokens[" UND "]).toBe(" AND ");
  });

  it("uses the selected language for date, number and automation formatting", () => {
    expect(i18n).toContain("new Intl.NumberFormat(locale(),options)");
    expect(i18n).toContain("new Intl.DateTimeFormat(locale(),options)");
    expect(app).toContain("function appLocale(){return appI18n?.locale?.()||'de-DE'}");
    expect(app).toContain("appI18n?.formatNumber?.(value,{maximumFractionDigits:1})");
    expect(app).toContain("toLocaleString(appLocale()");
    expect(automationUi).toContain("function automationLocale(){return globalThis.SaltaI18n?.locale?.()||'de-DE'}");
    expect(automationUi).toContain("toLocaleString(automationLocale()");
  });

  it("serves localization assets publicly so the login screen can be localized", () => {
    expect(server).toContain('"/i18n.js", "/i18n/de.json", "/i18n/en.json"');
    expect(server).toContain('["/i18n.js", "i18n.js"]');
    expect(server).toContain('["/i18n/de.json", "i18n/de.json"]');
    expect(server).toContain('["/i18n/en.json", "i18n/en.json"]');
    expect(server).toContain('".json": "application/json; charset=utf-8"');
  });

  it("rerenders localized dynamic surfaces when the browser language changes", () => {
    expect(app).toContain("document.addEventListener('salta:languagechange',refreshLocalizedApplication)");
    expect(app).toContain("renderDevices();updateDashboardSummary();renderDaylightOverview();renderVacationMode();renderClimateMode();renderBatteryOverview()");
    expect(app).toContain("if(typeof renderAutomations==='function')renderAutomations()");
  });

  it("keeps the sidebar language selector compact so labels are not clipped", () => {
    expect(styles).toContain(".sidebar-footer .language-control{grid-template-columns:1fr;align-items:stretch;gap:8px}");
    expect(styles).toContain(".sidebar-footer .language-control select{justify-self:end;width:120px;max-width:100%;min-width:0}");
  });
});
