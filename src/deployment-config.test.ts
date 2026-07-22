import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const compose = readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8");
const environmentExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const installer = readFileSync(new URL("../install.sh", import.meta.url), "utf8");

describe("v0.5 deployment configuration", () => {
  it("passes every mandatory SALTA secret through Docker Compose", () => {
    expect(compose).toContain("SALTA_HEALTH_TOKEN: ${SALTA_HEALTH_TOKEN:?Set SALTA_HEALTH_TOKEN in .env}");
    expect(compose).toContain("SALTA_ENCRYPTION_KEY: ${SALTA_ENCRYPTION_KEY:?Set SALTA_ENCRYPTION_KEY in .env}");
    expect(compose).toContain("ADMIN_PASSWORD: ${ADMIN_PASSWORD:?Set ADMIN_PASSWORD in .env}");
    expect(compose).toContain("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}");
  });

  it("documents every mandatory secret in the environment example", () => {
    for (const variable of ["SALTA_HEALTH_TOKEN", "SALTA_ENCRYPTION_KEY", "ADMIN_PASSWORD", "POSTGRES_PASSWORD"]) {
      expect(environmentExample).toMatch(new RegExp(`^${variable}=.+$`, "m"));
    }
  });

  it("provides a complete fresh-install mode and omits retired variables", () => {
    expect(installer).toContain("--fresh");
    expect(installer).toContain("rm -f .env");
    expect(compose).not.toContain("POSTGRES_HOST_PORT");
    expect(environmentExample).not.toContain("POSTGRES_HOST_PORT");
    expect(environmentExample).not.toContain("MOCK_EVENT_INTERVAL_MS");
  });
});
