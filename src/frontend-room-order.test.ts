import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("room ordering controls", () => {
  it("moves rooms through the persistent room-order API", () => {
    expect(appSource).toContain("async function moveRoom(id,direction)");
    expect(appSource).toContain("'/api/rooms/order'");
    expect(appSource).toContain("roomIds:ordered.map(room=>room.id)");
  });

  it("offers accessible up and down controls", () => {
    expect(appSource).toContain("nach oben verschieben");
    expect(appSource).toContain("nach unten verschieben");
    expect(appSource).toContain("room-order-button");
    expect(styles).toContain(".room-order-controls{display:grid;gap:3px}");
  });
});
