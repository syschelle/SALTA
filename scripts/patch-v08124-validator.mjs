import { readFileSync, writeFileSync } from "node:fs";

function replaceExact(file, from, to) {
  const source = readFileSync(file, "utf8");
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${file}: expected one occurrence of ${JSON.stringify(from)}, found ${count}`);
  writeFileSync(file, source.replace(from, to), "utf8");
}

replaceExact(
  "scripts/validate-release.mjs",
  `if (!diagnosticExportSource.includes('server.get("/api/diagnostics/export"') || !diagnosticExportSource.includes("listAutomations()") || !diagnosticExportSource.includes("listSystemLogs(100)") || !diagnosticExportSource.includes("assertDiagnosticDoesNotContainSecrets(payload, secrets)")) fail("Sanitized diagnostic export backend is incomplete");`,
  `if (!diagnosticExportSource.includes('server.get("/api/diagnostics/export"') || !diagnosticExportSource.includes("listAutomations()") || !diagnosticExportSource.includes("listSystemLogs(100, undefined, undefined, { includeHidden: true, collapse: false })") || !diagnosticExportSource.includes("assertDiagnosticDoesNotContainSecrets(payload, secrets)")) fail("Sanitized diagnostic export backend is incomplete or system-log filters leak into diagnostics");`
);

replaceExact(
  "src/diagnostic-export-frontend.test.ts",
  `    expect(backend).toContain("listSystemLogs(100)");`,
  `    expect(backend).toContain(\n      "listSystemLogs(100, undefined, undefined, { includeHidden: true, collapse: false })"\n    );`
);

console.log("Aligned diagnostic export validator and regression test with explicit unfiltered system-log export.");
