import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("persistent theme switching", () => {
  it("applies the saved cookie before the stylesheet paints", () => {
    expect(html).toContain("salta_theme=");
    expect(html).toContain("document.documentElement.dataset.theme = theme");
    expect(html).toContain('id="themeToggle"');
  });

  it("switches live and persists the selected theme in a cookie", () => {
    expect(source).toContain("const THEME_COOKIE='salta_theme'");
    expect(source).toContain("Max-Age=${THEME_COOKIE_MAX_AGE}; Path=/; SameSite=Lax");
    expect(source).toContain("themeToggleElement?.addEventListener('click',toggleTheme)");
    expect(source).toContain("document.documentElement.dataset.theme=theme");
    expect(source).not.toContain("localStorage");
  });

  it("defines an accessible dark palette and honors reduced motion", () => {
    expect(styles).toContain('html[data-theme="dark"]');
    expect(styles).toContain("color-scheme:dark");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
    expect(styles).toContain('.theme-toggle[aria-pressed="true"]');
  });
});
