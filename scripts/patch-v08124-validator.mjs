import { readFileSync, writeFileSync } from "node:fs";

const file = "scripts/validate-release.mjs";
const source = readFileSync(file, "utf8");
const from = `if (!diagnosticExportSource.includes('server.get("/api/diagnostics/export"') || !diagnosticExportSource.includes("listAutomations()") || !diagnosticExportSource.includes("listSystemLogs(100)") || !diagnosticExportSource.includes("assertDiagnosticDoesNotContainSecrets(payload, secrets)")) fail("Sanitized diagnostic export backend is incomplete");`;
const to = `if (!diagnosticExportSource.includes('server.get("/api/diagnostics/export"') || !diagnosticExportSource.includes("listAutomations()") || !diagnosticExportSource.includes("listSystemLogs(100, undefined, undefined, { includeHidden: true, collapse: false })") || !diagnosticExportSource.includes("assertDiagnosticDoesNotContainSecrets(payload, secrets)")) fail("Sanitized diagnostic export backend is incomplete or system-log filters leak into diagnostics");`;
const count = source.split(from).length - 1;
if (count !== 1) throw new Error(`Expected one diagnostic validator contract, found ${count}`);
writeFileSync(file, source.replace(from, to), "utf8");
console.log("Aligned diagnostic export validator with explicit unfiltered system-log export.");
