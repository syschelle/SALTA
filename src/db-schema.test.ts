import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const databaseSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const secretSource = readFileSync(new URL("./security/secrets.ts", import.meta.url), "utf8");

describe("v0.5 clean database schema", () => {
  it("uses one canonical schema without incremental migration statements", () => {
    expect(databaseSource).toContain("CREATE TABLE IF NOT EXISTS salta_metadata");
    expect(databaseSource).toContain('DATABASE_SCHEMA_VERSION = "0.5"');
    expect(databaseSource).not.toMatch(/ALTER\s+TABLE/i);
    expect(databaseSource).not.toContain("upgradeCredentialEncryption");
  });

  it("does not restore the removed duplicate room-name column", () => {
    const devicesTable = databaseSource.match(/CREATE TABLE IF NOT EXISTS devices \(([\s\S]*?)\n    \);/i)?.[1] ?? "";
    expect(devicesTable).toContain("room_id uuid");
    expect(devicesTable).not.toMatch(/^\s*room\s+text/im);
    expect(databaseSource).not.toContain("Create room automatically from its name");
    expect(databaseSource).not.toContain("SELECT id FROM rooms WHERE name=$1");
  });

  it("accepts only the current v2 encrypted-secret format", () => {
    expect(secretSource).toContain('parts[0] === "v2"');
    expect(secretSource).not.toContain('parts[0] === "v1"');
    expect(secretSource).not.toContain("legacyKey");
  });
});
