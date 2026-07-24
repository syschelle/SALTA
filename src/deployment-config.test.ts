import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const productionCompose = readFileSync(new URL("../docker-compose.image.yml", import.meta.url), "utf8");
const environmentExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const installer = readFileSync(new URL("../install.sh", import.meta.url), "utf8");
const updater = readFileSync(new URL("../update.sh", import.meta.url), "utf8");
const backupScript = readFileSync(new URL("../backup.sh", import.meta.url), "utf8");
const restoreScript = readFileSync(new URL("../restore.sh", import.meta.url), "utf8");

const productionScripts = [installer, updater, backupScript, restoreScript];

describe("production deployment configuration", () => {
  it("provides docker-compose.image.yml as a complete standalone production deployment", () => {
    expect(productionCompose).toContain("name: salta");
    expect(productionCompose).toContain("postgres:");
    expect(productionCompose).toContain("image: postgres:17-alpine");
    expect(productionCompose).toContain("salta:");
    expect(productionCompose).toContain("image: ${SALTA_IMAGE:-ghcr.io/syschelle/salta:0.7.0}");
    expect(productionCompose).toContain("salta_postgres_data:");
    expect(productionCompose).toContain("frontend:");
    expect(productionCompose).toContain("backend:");
    expect(productionCompose).toContain("condition: service_healthy");
    expect(productionCompose).toContain("internal: true");
  });

  it("passes every mandatory SALTA secret through the standalone production deployment", () => {
    expect(productionCompose).toContain("SALTA_HEALTH_TOKEN: ${SALTA_HEALTH_TOKEN:?Set SALTA_HEALTH_TOKEN in .env}");
    expect(productionCompose).toContain("SALTA_ENCRYPTION_KEY: ${SALTA_ENCRYPTION_KEY:?Set SALTA_ENCRYPTION_KEY in .env}");
    expect(productionCompose).toContain("ADMIN_PASSWORD: ${ADMIN_PASSWORD:?Set ADMIN_PASSWORD in .env}");
    expect(productionCompose).toContain("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}");
  });

  it("uses only docker-compose.image.yml for production operations", () => {
    for (const script of productionScripts) {
      expect(script).toContain("-f docker-compose.image.yml");
      expect(script).not.toContain("-f docker-compose.yml -f docker-compose.image.yml");
    }
  });

  it("documents every mandatory secret in the environment example", () => {
    for (const variable of ["SALTA_HEALTH_TOKEN", "SALTA_ENCRYPTION_KEY", "ADMIN_PASSWORD", "POSTGRES_PASSWORD"]) {
      expect(environmentExample).toMatch(new RegExp(`^${variable}=.+$`, "m"));
    }
  });

  it("provides a complete fresh-install mode and omits retired variables", () => {
    expect(installer).toContain("--fresh");
    expect(installer).toContain("rm -f .env");
    expect(productionCompose).not.toContain("POSTGRES_HOST_PORT");
    expect(environmentExample).not.toContain("POSTGRES_HOST_PORT");
    expect(environmentExample).not.toContain("MOCK_EVENT_INTERVAL_MS");
  });

  it("does not execute .env as shell code in backup and restore scripts", () => {
    for (const script of [backupScript, restoreScript]) {
      expect(script).toContain("--env-file .env");
      expect(script).not.toMatch(/(?:^|\n)\s*\.\s+\.\/\.env/);
    }
    expect(backupScript).toContain('pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"');
    expect(restoreScript).toContain('pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"');
  });
});
