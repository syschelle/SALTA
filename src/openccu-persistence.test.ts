import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const databaseSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("./server.ts", import.meta.url), "utf8");

 describe("OpenCCU credential persistence", () => {
  it("encrypts the OpenCCU password and never returns it from the settings API", () => {
    expect(databaseSource).toContain("encryptSecret(password)");
    expect(databaseSource).toContain("passwordConfigured: Boolean(secret)");
    expect(databaseSource).toContain("password: decryptStoredSecret(row?.encrypted_password)");
    expect(serverSource).toContain('app.get("/api/settings/openccu"');
    expect(serverSource).not.toContain("password: connection.password");
  });
});
