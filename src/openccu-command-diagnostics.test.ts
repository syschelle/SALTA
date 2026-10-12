import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adapter = readFileSync(new URL("./openccu-adapter.ts", import.meta.url), "utf8");

describe("OpenCCU command diagnostics", () => {
  it("logs exact Interface.setValue writes for successful and failed commands", () => {
    expect(adapter).toContain('"OPENCCU_COMMAND_APPLIED"');
    expect(adapter).toContain('"OPENCCU_COMMAND_FAILED"');
    expect(adapter).toContain('method: "Interface.setValue"');
    expect(adapter).toContain("valueKey: write.parameter");
    expect(adapter).toContain("writes: diagnosticWrites");
    expect(adapter).toContain("appliedWrites");
  });
});
