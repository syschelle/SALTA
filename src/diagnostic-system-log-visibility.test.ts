import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const databaseSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const diagnosticExportSource = readFileSync(new URL("./diagnostic-export.ts", import.meta.url), "utf8");

describe("system log diagnostic visibility", () => {
  it("keeps saved hide patterns scoped to the normal log view", () => {
    expect(databaseSource).toContain("options.includeHidden === false");
    expect(diagnosticExportSource).toContain(
      "listSystemLogs(100, undefined, undefined, { includeHidden: true, collapse: false })"
    );
  });
});
