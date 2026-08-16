import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectFile = (name: string) => new URL(`../${name}`, import.meta.url);
const readProjectFile = (name: string) => {
  const file = projectFile(name);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
};

const productionCompose = readProjectFile("docker-compose.image.yml");
const environmentExample = readProjectFile(".env.example");
const installer = readProjectFile("install.sh");
const updater = readProjectFile("update.sh");
const backupScript = readProjectFile("backup.sh");
const restoreScript = readProjectFile("restore.sh");
const homeKitMigrationScript = readProjectFile("migrate-homekit-storage.sh");
const migrationPathDoc = readProjectFile("MIGRATION_PATH.md");

const requiredDeploymentFiles = ["docker-compose.image.yml", ".env.example"];
const productionScripts = [installer, updater, backupScript, restoreScript].filter(Boolean);

describe("production deployment configuration", () => {
  it("ships the standalone production deployment contract", () => {
    for (const file of requiredDeploymentFiles) {
      expect(existsSync(projectFile(file)), `required production file is missing: ${file}`).toBe(true);
    }
  });

  it("provides docker-compose.image.yml as a complete standalone production deployment", () => {
    expect(productionCompose).toContain("name: salta");
    expect(productionCompose).toContain("postgres:");
    expect(productionCompose).toContain("image: postgres:17-alpine");
    expect(productionCompose).toContain("salta:");
    expect(productionCompose).toContain("image: ${SALTA_IMAGE:-ghcr.io/syschelle/salta:0.8.76}");
    expect(productionCompose).toContain("salta_postgres_data:");
    expect(productionCompose).toContain("salta_runtime_data:");
    expect(productionCompose).toContain("name: salta_runtime_data");
    expect(productionCompose).toContain("salta_runtime_data:/var/lib/salta");
    expect(productionCompose).toContain("HOMEKIT_STORAGE_PATH: /var/lib/salta/homekit");
    expect(productionCompose).toContain("SALTA_RUNTIME_SETTINGS_PATH: /var/lib/salta/runtime/settings.json");
    expect(productionCompose).toContain("network_mode: host");
    expect(productionCompose).toContain('127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432');
    expect(productionCompose).toContain("pg_isready -h 127.0.0.1 -p 5432");
    expect(productionCompose).toContain("DATABASE_URL: postgres://${POSTGRES_USER:-salta}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_HOST_PORT:-5433}/${POSTGRES_DB:-salta}");
    expect(productionCompose).toContain("condition: service_healthy");
    expect(productionCompose).not.toContain("internal: true");
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

  it("keeps optional fresh-install helpers complete and omits retired variables", () => {
    if (installer) {
      expect(installer).toContain("--fresh");
      expect(installer).toContain("rm -f .env");
      expect(installer).toContain("docker volume rm salta_runtime_data");
    }
    expect(productionCompose).toContain("POSTGRES_HOST_PORT");
    expect(environmentExample).toContain("POSTGRES_HOST_PORT=5433");
    expect(environmentExample).not.toContain("HOMEKIT_BIND_ADDRESS");
    expect(environmentExample).not.toContain("MOCK_EVENT_INTERVAL_MS");
  });

  it("uses host networking only for SALTA and publishes PostgreSQL on host loopback only", () => {
    expect(productionCompose).not.toContain("HOMEKIT_BIND_ADDRESS");
    expect(productionCompose).not.toContain('${HOMEKIT_PORT:-51826}:${HOMEKIT_PORT:-51826}/tcp');
    expect((productionCompose.match(/network_mode: host/g) ?? [])).toHaveLength(1);
    expect(productionCompose).toContain('127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432');
    expect(productionCompose).toContain("pg_isready -h 127.0.0.1 -p 5432");
    expect(productionCompose).toContain("DATABASE_URL: postgres://${POSTGRES_USER:-salta}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_HOST_PORT:-5433}/${POSTGRES_DB:-salta}");
    expect(productionCompose).not.toContain("internal: true");
    expect(productionCompose).not.toContain("listen_addresses=127.0.0.1");
    expect(productionCompose).not.toContain("networks:\n");
  });

  it("ships and documents the one-time migration helper for pre-v0.8.41 HomeKit pairing state", () => {
    expect(homeKitMigrationScript).toContain('LEGACY_PATH="/app/persist"');
    expect(homeKitMigrationScript).toContain('VOLUME_NAME="${SALTA_RUNTIME_VOLUME:-salta_runtime_data}"');
    expect(homeKitMigrationScript).toContain('docker cp "$CONTAINER_NAME:$LEGACY_PATH/."');
    expect(migrationPathDoc).toContain("/opt/SALTA/migrate-homekit-storage.sh");
    expect(migrationPathDoc).toContain("/app/persist");
    expect(migrationPathDoc).toContain("/var/lib/salta/homekit");
  });

  it("does not execute .env as shell code in optional backup and restore helpers", () => {
    for (const script of [backupScript, restoreScript].filter(Boolean)) {
      expect(script).toContain("--env-file .env");
      expect(script).not.toMatch(/(?:^|\n)\s*\.\s+\.\/\.env/);
    }
    if (backupScript) expect(backupScript).toContain('pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"');
    if (restoreScript) expect(restoreScript).toContain('pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"');
  });
});
