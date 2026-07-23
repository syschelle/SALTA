import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

describe("device presentation configuration", () => {
  it("offers automatic, light, switch, outlet and fan roles", () => {
    expect(html).toContain('id="devicePresentationType"');
    for (const value of ["auto", "light", "switch", "outlet", "fan"]) {
      expect(html).toContain(`option value="${value}"`);
    }
  });

  it("stores the selected role and uses it for dashboard presentation", () => {
    expect(source).toContain("const presentationType=devicePresentationSection.hidden");
    expect(source).toContain("const config={name,roomId:deviceRoom.value||null,presentationType}");
    expect(source).toContain("body:JSON.stringify(config)");
    expect(source).toContain("const visualType=resolvedPresentationType(d)");
    expect(source).toContain("fan:'Ventilator'");
  });
});
