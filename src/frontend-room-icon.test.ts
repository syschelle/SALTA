import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const htmlSource = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

describe("room icon selection", () => {
  it("uses a curated selection instead of a free-text icon field", () => {
    expect(appSource).toContain("const roomIconChoices=[");
    expect(appSource).toContain("function roomIconOptions");
    expect(appSource).toContain('<select name="icon" required');
    expect(htmlSource).toContain('<select id="newRoomIcon" required></select>');
    expect(htmlSource).toContain('class="room-icon-preview"');
    expect(appSource).toContain('updateRoomIconPreview');
    expect(htmlSource).not.toContain('placeholder="z. B. sofa-outline"');
  });

  it("offers common room types with local MDI icons", () => {
    for (const value of ["sofa-outline", "bed-outline", "silverware-fork-knife", "bathtub-outline", "garage-variant"]) {
      expect(appSource).toContain(value);
    }
  });
});
