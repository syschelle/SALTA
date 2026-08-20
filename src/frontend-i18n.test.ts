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

function translateEnglish(source: string): string {
  const exact = en.phrases?.[source];
  if (typeof exact === "string") return exact;
  for (const pattern of en.patterns ?? []) {
    const regex = new RegExp(pattern.match, pattern.flags || "");
    if (regex.test(source)) return source.replace(regex, pattern.replace);
  }
  let translated = source;
  for (const [from, to] of Object.entries(en.tokens ?? {})) translated = translated.split(from).join(String(to));
  return translated;
}

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
    expect(Object.keys(en.phrases).length).toBeGreaterThanOrEqual(900);
    expect(en.patterns.length).toBeGreaterThanOrEqual(80);
    expect(countKeys(en.language)).toBe(countKeys(de.language));
    expect(Object.keys(en.phrases).sort()).toEqual(Object.keys(de.phrases).sort());
    expect(en.patterns.map((entry: { match: string }) => entry.match)).toEqual(de.patterns.map((entry: { match: string }) => entry.match));
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

  it("covers dynamic status, credential, diagnostics and device-info text in English", () => {
    const samples: Array<[string, string]> = [
      ["DEBUG aktiv", "DEBUG enabled"],
      ["DEBUG · FEHLER", "DEBUG · ERROR"],
      ["Fehler: nur fehlgeschlagene Diagnoseaktionen können per Pushover gemeldet werden.", "Errors: only failed diagnostic actions can be reported via Pushover."],
      ["Ein API-Schlüssel ist verschlüsselt gespeichert. Leer lassen, um ihn beizubehalten.", "An API key is stored encrypted. Leave blank to keep it."],
      ["Ein Passwort ist verschlüsselt gespeichert. Leer lassen, um es beizubehalten.", "A password is stored encrypted. Leave blank to keep it."],
      ["Realtime: Eventstream verbunden · Letztes Event 06:46:51 PM", "Realtime: event stream connected · Last event 06:46:51 PM"],
      ["37 Geräte · Synchronisiert 8/17/2026, 6:47:43 PM", "37 devices · Synchronized 8/17/2026, 6:47:43 PM"],
      ["Bridge ist mit Apple Home gekoppelt.", "Bridge is paired with Apple Home."],
      ["11 von 11 Thermostaten unterstützt · zuletzt angewendet 8/13/26, 10:55 AM · 11 erfolgreich", "11 of 11 thermostats supported · last applied 8/13/26, 10:55 AM · 11 successful"],
      ["Aktuell: Sommer · Winter: Handbetrieb", "Current: Summer · Winter: Manual"],
      ["Letzte Batteriewarnung 8/14/2026, 11:46:55 AM · frühestens wieder 8/21/2026, 11:46:55 AM", "Last battery warning 8/14/2026, 11:46:55 AM · next eligible 8/21/2026, 11:46:55 AM"],
      ["Zuletzt gesehen: 8/17/26, 6:50 PM", "Last seen: 8/17/26, 6:50 PM"],
      ["Passwort gespeichert", "Password stored"],
      ["Gerätetyp", "Device type"],
      ["Quelle", "Source"],
      ["DIAGNOSE & FEHLERSUCHE", "DIAGNOSTICS & TROUBLESHOOTING"],
      ["Diagnose abgeschlossen", "Diagnostics completed"],
      ["Realtime: WebSocket verbunden", "Realtime: WebSocket connected"],
      ["Kein Trigger verfügbar", "No trigger available"],
      ["Automation konnte nicht gespeichert werden.", "Automation could not be saved."],
      ["deCONZ-Oberfläche öffnen", "Open deCONZ interface"],
      ["deCONZ-Verbindung wurde gespeichert und geprüft.", "deCONZ connection was saved and verified."],
      ["Die deCONZ-Adresse ist ungültig. Beispiel: http://192.168.178.20:8080", "The deCONZ address is invalid. Example: http://192.168.178.20:8080"],
    ];
    for (const [source, expected] of samples) expect(translateEnglish(source), source).toBe(expected);
  });

  it("uses the selected language for date, number and automation formatting", () => {
    expect(i18n).toContain("new Intl.NumberFormat(locale(),options)");
    expect(i18n).toContain("new Intl.DateTimeFormat(locale(),options)");
    expect(app).toContain("function appLocale(){return appI18n?.locale?.()||'de-DE'}");
    expect(app).toContain("appI18n?.formatNumber?.(value,{maximumFractionDigits:1})");
    expect(app).toContain("toLocaleString(appLocale()")
    expect(app).not.toContain(".toLocaleString()")
    expect(app).toContain("new Date(report.completedAt).toLocaleString(appLocale())")
    expect(app).toContain("new Date(gateway.lastSync).toLocaleString(appLocale())");
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
