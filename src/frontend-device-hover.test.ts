import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("device card interaction styling", () => {
  it("keeps device cards stationary on hover", () => {
    expect(styles).not.toContain(".device:hover");
    expect(styles).not.toContain(".device{transition:");
  });

  it("applies elevation feedback only to actionable controls", () => {
    expect(styles).toContain("button:not(:disabled):hover,.button-link:hover");
    expect(styles).toContain("transform:translateY(-1px)");
    expect(styles).toContain("button:not(:disabled):active,.button-link:active");
  });
});
