import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const frontend = readFileSync(new URL("../public/diagnostic-export.js", import.meta.url), "utf8");
const backend = readFileSync(new URL("./diagnostic-export.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

describe("full sanitized SALTA diagnostic export", () => {
  it("adds a one-click export to the system log page", () => {
    expect(html).toContain('id="diagnosticExportButton"');
    expect(html).toContain('onclick="exportSaltaDiagnostics()"');
    expect(html).toContain('<script src="/diagnostic-export.js"></script>');
    expect(frontend).toContain("fetch('/api/diagnostics/export'");
    expect(frontend).toContain("link.download=diagnosticExportFilename(response)");
  });

  it("exports runtime logic and diagnostics through the authenticated SALTA server", () => {
    expect(main).toContain("registerDiagnosticExportRoute(server");
    expect(backend).toContain('server.get("/api/diagnostics/export"');
    expect(backend).toContain("listAutomations()");
    expect(backend).toContain("listSystemLogs(100)");
    expect(backend).toContain("deps.registry.all().map(safeDiagnosticDevice)");
    expect(backend).toContain("presenceTargets.map(safePresenceTarget)");
    expect(backend).toContain("assertDiagnosticDoesNotContainSecrets(payload, secrets)");
    expect(backend).toContain("DIAGNOSTIC_EXPORT_FORMAT_VERSION = 2");
    expect(backend).toContain('device.source !== "presence"');
    expect(backend).toContain("configuredIpAddress: _configuredIpAddress");
    expect(backend).toContain("configuredMacAddress: _configuredMacAddress");
    expect(backend).toContain('credentialsIncluded: false');
  });
});
