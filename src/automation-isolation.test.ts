import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const automationCore = readFileSync(new URL("./automations.ts", import.meta.url), "utf8");
const persistence = readFileSync(new URL("./automation-persistence.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const testRunner = readFileSync(new URL("../scripts/check-test-symbols.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const requiredTestVariables = ["DATABASE_URL", "ADMIN_PASSWORD", "SALTA_HEALTH_TOKEN", "SALTA_ENCRYPTION_KEY"];

describe("automation test isolation", () => {
  it("keeps the automation core independent from database/config side effects", () => {
    expect(automationCore).not.toContain('from "./db.js"');
    expect(automationCore).toContain("private readonly store: AutomationStore");
    expect(automationCore).toContain("private readonly logger: AutomationLogger");
    expect(persistence).toContain('from "./db.js"');
    expect(main).toContain("databaseAutomationStore");
    expect(main).toContain("databaseAutomationLogger");
    expect(main).toContain("applyClimateMode: async mode");
  });

  it("starts Vitest through the existing preflight runner with deterministic test configuration", () => {
    expect(packageJson.scripts.test).toBe("node scripts/check-test-symbols.mjs --vitest");
    expect(testRunner).toContain('resolve(root, "node_modules", "vitest", "vitest.mjs")');
    expect(testRunner).toContain('NODE_ENV: "test"');
    for (const variable of requiredTestVariables) {
      expect(testRunner).toContain(`${variable}: process.env.${variable} ??`);
    }
  });

  it("does not require a separate Vitest root configuration file for mandatory environment defaults", () => {
    expect(testRunner).not.toContain("vitest.config.ts");
    expect(testRunner).not.toContain("test-setup.ts");
  });
});
