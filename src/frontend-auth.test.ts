import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("../public/login.html", import.meta.url), "utf8");

describe("authenticated web application", () => {
  it("loads a protected browser session before application data", () => {
    expect(appSource).toContain("async function initializeSession()");
    expect(appSource).toContain("headers.set('X-SALTA-CSRF',csrfToken)");
    expect(appSource).toContain("async function initializeApplication()")
    expect(appSource).toContain("await appI18n?.init?.().catch(()=>undefined)")
    expect(appSource).toContain("await initializeSession();")
    expect(appSource).toContain("await loadAppearanceSettings().catch(()=>undefined);")
    expect(appSource.indexOf("await initializeSession();")).toBeLessThan(appSource.indexOf("await loadAppearanceSettings().catch(()=>undefined);"))
  });

  it("provides login and logout controls", () => {
    expect(loginSource).toContain('id="loginForm"');
    expect(indexSource).toContain('id="logoutButton"');
  });

  it("redirects only when SALTA session authentication is missing", () => {
    expect(appSource).toContain("response.status===401&&code==='UNAUTHORIZED'");
    expect(appSource).not.toContain("if(response.status===401){location.replace('/login')");
    expect(appSource).toContain("AUTHENTICATION_FAILED:'Authentifizierung fehlgeschlagen.");
  });

  it("loads the theme initializer from an external script for CSP compatibility", () => {
    expect(indexSource).toContain('<script src="/theme-init.js"></script>');
    expect(indexSource).not.toContain("document.cookie.split('; ')");
  });
});
