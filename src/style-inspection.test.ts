import { describe, expect, it } from "vitest";
import { cssRuleContains } from "./test-utils/style-inspection.js";

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
});
