import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("../public/login.html", import.meta.url), "utf8");

describe("authenticated web application", () => {
  it("loads a protected browser session before application data", () => {
    expect(appSource).toContain("async function initializeSession()");
    expect(appSource).toContain("headers.set('X-SALTA-CSRF',csrfToken)");
    expect(appSource).toContain("initializeSession().then(()=>{navigate();load();setInterval(refreshLiveData,5000)}")
  });

  it("provides login and logout controls", () => {
    expect(loginSource).toContain('id="loginForm"');
    expect(indexSource).toContain('id="logoutButton"');
  });

  it("loads the theme initializer from an external script for CSP compatibility", () => {
    expect(indexSource).toContain('<script src="/theme-init.js"></script>');
    expect(indexSource).not.toContain("document.cookie.split('; ')");
  });
});
