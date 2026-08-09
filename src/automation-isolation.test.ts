import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const automationCore = readFileSync(new URL("./automations.ts", import.meta.url), "utf8");
const persistence = readFileSync(new URL("./automation-persistence.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const vitestConfig = readFileSync(new URL("../vitest.config.ts", import.meta.url), "utf8");
const testSetup = readFileSync(new URL("./test-setup.ts", import.meta.url), "utf8");

describe("automation test isolation", () => {
  it("keeps the automation core independent from database/config side effects", () => {
    expect(automationCore).not.toContain('from "./db.js"');
    expect(automationCore).toContain("private readonly store: AutomationStore");
    expect(automationCore).toContain("private readonly logger: AutomationLogger");
    expect(persistence).toContain('from "./db.js"');
    expect(main).toContain("databaseAutomationStore, databaseAutomationLogger");
  });

  it("provides required application secrets centrally before Vitest imports test modules", () => {
    expect(vitestConfig).toContain('setupFiles: ["./src/test-setup.ts"]');
    for (const variable of ["DATABASE_URL", "ADMIN_PASSWORD", "SALTA_HEALTH_TOKEN", "SALTA_ENCRYPTION_KEY"]) {
      expect(testSetup).toContain(`process.env.${variable} ??=`);
    }
  });
});
