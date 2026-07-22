import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("compact device-card layout", () => {
  it("does not stretch short cards to the height of the tallest card in a row", () => {
    expect(styles).toContain("align-items:start");
    expect(styles).toContain(".device{align-self:start;padding:16px}");
  });

  it("uses compact spacing for values, actions and cover controls", () => {
    expect(styles).toContain("margin-top:11px;padding-top:10px");
    expect(styles).toContain(".actions{display:flex;gap:6px;margin-top:11px");
    expect(styles).toContain(".cover-control{margin-top:11px;padding:10px 12px");
  });
});
