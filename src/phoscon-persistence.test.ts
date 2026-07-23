import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const databaseSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("./server.ts", import.meta.url), "utf8");

describe("Phoscon credential persistence", () => {
  it("stores the API key through the encrypted adapter-settings path", () => {
    expect(databaseSource).toContain("adapter_id='phoscon'");
    expect(databaseSource).toContain("apiKey ? encryptSecret(apiKey) :");
    expect(databaseSource).toContain("apiKeyConfigured: Boolean(secret)");
    expect(databaseSource).not.toContain("apiKey: row?.encrypted_password");
  });

  it("returns only configuration metadata to the browser", () => {
    expect(serverSource).toContain('app.get("/api/settings/phoscon"');
    expect(serverSource).toContain("getPhosconSettings()");
    expect(serverSource).not.toContain("getPhosconConnection()), gateway");
  });
});
