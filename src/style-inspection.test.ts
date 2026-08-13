import { describe, expect, it } from "vitest";
import { cssMediaRuleContains, cssRuleContains } from "../test-utils/style-inspection.js";

describe("CSS rule inspection", () => {
  it("finds a base declaration even when a later media query overrides the same selector", () => {
    const styles = `
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
      @media (max-width: 620px) { .grid { grid-template-columns: 1fr; gap: 8px; } }
    `;

    expect(
      cssRuleContains(styles, ".grid", "grid-template-columns:repeat(auto-fill,minmax(260px,1fr))"),
    ).toBe(true);
    expect(cssRuleContains(styles, ".grid", "grid-template-columns:1fr")).toBe(true);
  });

  it("normalizes harmless whitespace in declarations", () => {
    expect(cssRuleContains(".value { background: var(--subtle-bg); }", ".value", "background:var(--subtle-bg)")).toBe(true);
  });

  it("targets declarations inside a media query without requiring selector adjacency", () => {
    const styles = `
      @media (max-width: 620px) {
        .search { width: 100%; }
        .automation-card { padding: 11px; }
        .automation-card-actions { justify-content: stretch; }
      }
    `;

    expect(cssMediaRuleContains(styles, "(max-width:620px)", ".automation-card", "padding:11px")).toBe(true);
    expect(
      cssMediaRuleContains(styles, "(max-width:620px)", ".automation-card-actions", "justify-content:stretch"),
    ).toBe(true);
    expect(cssMediaRuleContains(styles, "(max-width:620px)", ".automation-card", "padding:12px")).toBe(false);
  });

});
