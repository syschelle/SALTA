import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("layout width consolidation", () => {
  it("defines shared width tokens for the main page, side columns and dialogs", () => {
    for (const token of [
      "--layout-sidebar:240px",
      "--layout-page-max:1680px",
      "--layout-gap:20px",
      "--layout-side-md:380px",
      "--layout-side-lg:480px",
      "--settings-content-max:820px",
      "--dialog-standard-width:680px",
      "--dialog-compact-width:640px",
      "--dialog-device-width:860px",
    ]) expect(styles).toContain(token);
  });

  it("reuses the shared widths across page layouts instead of isolated hard-coded variants", () => {
    expect(styles).toContain("grid-template-columns:var(--layout-sidebar) minmax(0,1fr)");
    expect(styles).toContain("max-width:var(--layout-page-max)");
    expect(styles).toContain("minmax(320px,var(--layout-side-md))");
    expect(styles).toContain("minmax(440px,var(--layout-side-lg))");
    expect(styles).toContain("minmax(0,var(--settings-content-max))");
    expect(styles).not.toContain("main{max-width:1680px}");
  });
});
