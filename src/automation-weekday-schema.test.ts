import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync(new URL("server.ts", import.meta.url), "utf8");

describe("automation weekday API schema typing", () => {
  it("keeps executionDays as the literal 1..7 union required by AutomationWeekday", () => {
    expect(server).toContain("const automationWeekdaySchema = z.union([");
    for (const day of [1, 2, 3, 4, 5, 6, 7]) {
      expect(server).toContain(`z.literal(${day})`);
    }
    expect(server).toContain("executionDays: z.array(automationWeekdaySchema)");
    expect(server).toContain("function normalizeAutomationInput(data: z.infer<typeof automationSchema>): AutomationInput");
    expect(server).not.toContain("executionDays: z.array(z.number().int().min(1).max(7))");
  });
});
