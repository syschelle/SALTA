import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { functionSource, parseJavaScriptSource } from "../test-utils/source-inspection.js";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const source = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const app = parseJavaScriptSource(source);

describe("overview favorites", () => {
  it("places a dedicated favorites area before room-grouped devices", () => {
    expect(html).toContain('id="overviewFavoritesSection"');
    expect(html).toContain('id="overviewFavoritesGrid"');
    expect(html.indexOf('id="overviewFavoritesSection"')).toBeLessThan(html.indexOf('id="overviewDeviceGrid"'));
    expect(html).toContain("Favoriten");
    expect(styles).toContain(".overview-favorites-grid");
  });

  it("renders favorite devices additionally without removing them from room groups", () => {
    const favorites = functionSource(app, "overviewFavoriteDevices");
    expect(favorites).toContain("Boolean(device.favorite)");
    expect(favorites).toContain("device.source!=='presence'");
    expect(favorites).toContain("device.source!=='system'");
    expect(functionSource(app, "renderOverviewFavorites")).toContain("deviceCard(device,false,'favorite')");
    expect(functionSource(app, "renderDevices")).toContain("renderOverviewFavorites()");
    expect(functionSource(app, "renderDevices")).toContain("renderOverviewDevices()");
  });
});
