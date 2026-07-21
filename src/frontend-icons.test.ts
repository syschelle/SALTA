import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const mdiCss = readFileSync(new URL("../public/vendor/mdi/materialdesignicons.min.css", import.meta.url), "utf8");

describe("locally bundled Material Design Icons", () => {
  it("loads MDI from local application assets", () => {
    expect(html).toContain('href="/vendor/mdi/materialdesignicons.min.css"');
    expect(html).not.toMatch(/href="https?:\/\/[^\"]*(?:mdi|pictogrammers)/i);
    expect(mdiCss).toContain('url("fonts/materialdesignicons-webfont.woff2?v=7.4.47")');
    expect(existsSync(new URL("../public/vendor/mdi/fonts/materialdesignicons-webfont.woff2", import.meta.url))).toBe(true);
  });

  it("uses MDI for navigation, devices, rooms and theme switching", () => {
    expect(html).toContain("mdi-home-outline");
    expect(html).toContain("mdi-weather-night");
    expect(source).toContain("mdi-power-socket-eu");
    expect(source).toContain("iconMarkup(r.icon||'home-outline')");
    expect(source).not.toContain("outlet:'◉'");
  });

  it("documents source and license attribution", () => {
    expect(readme).toContain("Material Design Icons (MDI)");
    expect(readme).toContain("Pictogrammers");
    expect(readme).toContain("Apache License 2.0");
    expect(existsSync(new URL("../public/vendor/mdi/LICENSE", import.meta.url))).toBe(true);
  });
});
