import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../public/homekit-qr.js", import.meta.url), "utf8");

type QrContext = {
  createHomeKitSetupQrMatrix?: (value: string) => boolean[][];
  renderHomeKitSetupQrSvg?: (value: string) => string;
};

function loadQr(): Required<QrContext> {
  const context: QrContext = {};
  vm.runInNewContext(source, context, { filename: "homekit-qr.js" });
  if (!context.createHomeKitSetupQrMatrix || !context.renderHomeKitSetupQrSvg) throw new Error("HomeKit QR helpers were not exported");
  return context as Required<QrContext>;
}

describe("HomeKit setup QR", () => {
  it("matches the independent QR Version 1-L / mask 0 reference vector", () => {
    const { createHomeKitSetupQrMatrix } = loadQr();
    const matrix = createHomeKitSetupQrMatrix("X-HM://0023ISYWY9SKP");
    expect(matrix).toHaveLength(21);
    expect(matrix.every(row => row.length === 21)).toBe(true);
    const bits = matrix.flat().map(value => value ? "1" : "0").join("");
    expect(createHash("sha256").update(bits).digest("hex")).toBe("a775041c91438c0f4bf54bd7b458368a5613110175ddcc4523369adf4c3c76d5");
  });

  it("renders a local SVG without embedding the setup URI as external content", () => {
    const { renderHomeKitSetupQrSvg } = loadQr();
    const svg = renderHomeKitSetupQrSvg("X-HM://0023ISYWY9SKP");
    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toContain('aria-label="HomeKit Pairing QR-Code"');
    expect(svg).not.toContain("X-HM://");
    expect(svg).not.toMatch(/https?:\/\//);
  });

  it("rejects values outside the HomeKit alphanumeric setup URI contract", () => {
    const { createHomeKitSetupQrMatrix } = loadQr();
    expect(() => createHomeKitSetupQrMatrix("https://example.invalid")).toThrow("HOMEKIT_SETUP_URI_UNSUPPORTED");
  });
});
