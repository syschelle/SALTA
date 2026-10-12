import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ui = readFileSync(new URL("../public/automation-ui.js", import.meta.url), "utf8");
const server = readFileSync(new URL("./server.ts", import.meta.url), "utf8");

describe("automation manual actions frontend", () => {
  it("renders Run now and Duplicate controls on every automation card", () => {
    expect(ui).toContain("onclick=\"triggerAutomation('");
    expect(ui).toContain('title=\"Jetzt auslösen\"');
    expect(ui).toContain("onclick=\"duplicateAutomation('");
    expect(ui).toContain('title=\"Duplizieren\"');
  });

  it("uses the dedicated manual trigger API and duplicates rules as disabled copies", () => {
    expect(ui).toContain("async function triggerAutomation(id)");
    expect(ui).toContain("function automationDuplicatePayload(rule)");
    expect(ui).toContain("enabled:false");
    expect(server).toContain('"/api/automations/:id/trigger"');
    expect(server).toContain("automationEngine.triggerManually(request.params.id)");
  });
});
