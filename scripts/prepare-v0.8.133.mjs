import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = (file) => readFileSync(file, "utf8");
const write = (file, content) => writeFileSync(file, content, "utf8");
const replaceOnce = (file, from, to) => {
  const source = read(file);
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${file}: expected one occurrence of ${JSON.stringify(from)}, found ${count}`);
  write(file, source.replace(from, to));
};

execFileSync(process.execPath, ["scripts/set-version.mjs", "0.8.133"], { stdio: "inherit" });

replaceOnce(
  "src/fritzbox-smarthome.ts",
  'import { config } from "./config.js";\n',
  'import { config } from "./config.js";\nimport { sanitizeDiagnosticValue } from "./diagnostic-sanitizer.js";\n'
);

replaceOnce(
  "src/fritzbox-smarthome.ts",
  'function validSid(value: string | undefined): value is string { return Boolean(value && /^[0-9a-f]{16}$/i.test(value) && value !== zeroSid); }\n',
  `function validSid(value: string | undefined): value is string { return Boolean(value && /^[0-9a-f]{16}$/i.test(value) && value !== zeroSid); }\n\nfunction sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }\n\nexport function fritzBoxSmartHomeSafeErrorBody(text: string): unknown {\n  const trimmed = text.trim();\n  if (!trimmed) return undefined;\n  try { return sanitizeDiagnosticValue(JSON.parse(trimmed)); }\n  catch { return { format: "non-json", bytes: Buffer.byteLength(trimmed, "utf8") }; }\n}\n\nclass FritzBoxSmartHomeHttpError extends Error {\n  constructor(\n    readonly status: number,\n    readonly method: string,\n    readonly endpoint: string,\n    readonly responseBody: unknown\n  ) {\n    super(\`FRITZBOX_SMARTHOME_HTTP_\${status}\`);\n    this.name = "FritzBoxSmartHomeHttpError";\n  }\n}\n`
);

replaceOnce(
  "src/fritzbox-smarthome.ts",
  '  const blockTime = Number.parseInt(xmlValue(initial.text, "BlockTime") ?? "0", 10);\n  if (Number.isFinite(blockTime) && blockTime > 0) throw new Error("FRITZBOX_SMARTHOME_LOGIN_BLOCKED");\n  const challenge = xmlValue(initial.text, "Challenge");\n',
  '  const blockTime = Number.parseInt(xmlValue(initial.text, "BlockTime") ?? "0", 10);\n  const challenge = xmlValue(initial.text, "Challenge");\n'
);

replaceOnce(
  "src/fritzbox-smarthome.ts",
  '  const form = new URLSearchParams({ username, response: fritzBoxSidResponse(challenge, password) }).toString();\n  const authenticated = await request(`${origin}/login_sid.lua?version=2`, "POST", { accept: "application/xml,text/xml", "content-type": "application/x-www-form-urlencoded" }, form, tlsInsecure);\n',
  '  const form = new URLSearchParams({ username, response: fritzBoxSidResponse(challenge, password) }).toString();\n  if (Number.isFinite(blockTime) && blockTime > 0) await sleep(blockTime * 1000);\n  const authenticated = await request(`${origin}/login_sid.lua?version=2`, "POST", { accept: "application/xml,text/xml", "content-type": "application/x-www-form-urlencoded" }, form, tlsInsecure);\n'
);

replaceOnce(
  "src/fritzbox-smarthome.ts",
  '  private reconcileTask?: Promise<void>;\n  private sid = "";\n',
  '  private reconcileTask?: Promise<void>;\n  private loginTask?: Promise<string>;\n  private sid = "";\n'
);

replaceOnce(
  "src/fritzbox-smarthome.ts",
  '  stop(): void { this.running = false; if (this.timer) clearInterval(this.timer); this.timer = undefined; this.sid = ""; }\n',
  '  stop(): void { this.running = false; if (this.timer) clearInterval(this.timer); this.timer = undefined; this.loginTask = undefined; this.sid = ""; }\n'
);

replaceOnce(
  "src/fritzbox-smarthome.ts",
  '    const updated = await this.saveSettings(settings);\n    this.sid = "";\n',
  '    const updated = await this.saveSettings(settings);\n    this.loginTask = undefined;\n    this.sid = "";\n'
);

replaceOnce(
  "src/fritzbox-smarthome.ts",
  '  private async apiRequest(path: string, method = "GET", body?: unknown, retry = true): Promise<unknown> {\n    const connection = await this.connection();\n    if (!this.sid) this.sid = await login(connection.origin, connection.username, connection.password, connection.tlsInsecure, this.request);\n',
  `  private async ensureSid(connection: { origin: string; username: string; password: string; tlsInsecure: boolean }): Promise<string> {\n    if (this.sid) return this.sid;\n    if (!this.loginTask) {\n      this.loginTask = login(connection.origin, connection.username, connection.password, connection.tlsInsecure, this.request)\n        .then(sid => { this.sid = sid; return sid; })\n        .finally(() => { this.loginTask = undefined; });\n    }\n    return this.loginTask;\n  }\n\n  private async apiRequest(path: string, method = "GET", body?: unknown, retry = true): Promise<unknown> {\n    const connection = await this.connection();\n    await this.ensureSid(connection);\n`
);

replaceOnce(
  "src/fritzbox-smarthome.ts",
  '    if ((response.status === 401 || response.status === 403) && retry) { this.sid = ""; return this.apiRequest(path, method, body, false); }\n    if (response.status < 200 || response.status >= 300) throw new Error(`FRITZBOX_SMARTHOME_HTTP_${response.status}`);\n',
  '    if ((response.status === 401 || response.status === 403) && retry) { this.loginTask = undefined; this.sid = ""; return this.apiRequest(path, method, body, false); }\n    if (response.status < 200 || response.status >= 300) throw new FritzBoxSmartHomeHttpError(response.status, method, path, fritzBoxSmartHomeSafeErrorBody(response.text));\n'
);

replaceOnce(
  "src/fritzbox-smarthome.ts",
  '      const message = error instanceof Error ? error.message : String(error);\n      this.statusValue = { enabled: true, connected: false, deviceCount: this.registry.all().filter(device => device.source === "fritzbox").length, lastError: message, api: "rest-v0" };\n      await this.log("warning", "fritzbox-smarthome", "FRITZBOX_SMARTHOME_SYNC_FAILED", "FRITZ!Box Smart Home synchronization failed", { error: message }).catch(() => undefined);\n',
  `      const message = error instanceof Error ? error.message : String(error);\n      this.statusValue = { enabled: true, connected: false, deviceCount: this.registry.all().filter(device => device.source === "fritzbox").length, lastError: message, api: "rest-v0" };\n      const details = error instanceof FritzBoxSmartHomeHttpError\n        ? { error: message, status: error.status, method: error.method, endpoint: error.endpoint, responseBody: error.responseBody }\n        : { error: message };\n      await this.log("warning", "fritzbox-smarthome", "FRITZBOX_SMARTHOME_SYNC_FAILED", "FRITZ!Box Smart Home synchronization failed", details).catch(() => undefined);\n`
);

replaceOnce(
  "src/diagnostic-export.ts",
  'import type { FritzBoxPresenceAdapter } from "./fritzbox-presence.js";\n',
  'import type { FritzBoxPresenceAdapter } from "./fritzbox-presence.js";\nimport type { FritzBoxSmartHomeAdapter } from "./fritzbox-smarthome.js";\n'
);
replaceOnce(
  "src/diagnostic-export.ts",
  '  getFritzBoxPresenceSettings,\n',
  '  getFritzBoxPresenceSettings,\n  getFritzBoxSmartHomeSettings,\n'
);
replaceOnce(
  "src/diagnostic-export.ts",
  '  presence: Pick<FritzBoxPresenceAdapter, "getStatus">;\n',
  '  presence: Pick<FritzBoxPresenceAdapter, "getStatus">;\n  fritzSmartHome: Pick<FritzBoxSmartHomeAdapter, "status">;\n'
);
replaceOnce(
  "src/diagnostic-export.ts",
  '    fritzBoxSettings,\n    pushoverSettings,\n',
  '    fritzBoxSettings,\n    fritzBoxSmartHomeSettings,\n    pushoverSettings,\n'
);
replaceOnce(
  "src/diagnostic-export.ts",
  '    getFritzBoxPresenceSettings(),\n    getPushoverSettings(),\n',
  '    getFritzBoxPresenceSettings(),\n    getFritzBoxSmartHomeSettings(),\n    getPushoverSettings(),\n'
);
replaceOnce(
  "src/diagnostic-export.ts",
  '      fritzBoxPresence: {\n        baseUrl: fritzBoxSettings.baseUrl,\n        passwordConfigured: fritzBoxSettings.passwordConfigured,\n        encryptionStatus: fritzBoxSettings.encryptionStatus,\n        enabled: fritzBoxSettings.enabled,\n        pollIntervalSeconds: fritzBoxSettings.pollIntervalSeconds,\n        absenceDelaySeconds: fritzBoxSettings.absenceDelaySeconds,\n        tlsInsecure: fritzBoxSettings.tlsInsecure\n      },\n      pushover: pushoverSettings\n',
  '      fritzBoxPresence: {\n        baseUrl: fritzBoxSettings.baseUrl,\n        passwordConfigured: fritzBoxSettings.passwordConfigured,\n        encryptionStatus: fritzBoxSettings.encryptionStatus,\n        enabled: fritzBoxSettings.enabled,\n        pollIntervalSeconds: fritzBoxSettings.pollIntervalSeconds,\n        absenceDelaySeconds: fritzBoxSettings.absenceDelaySeconds,\n        tlsInsecure: fritzBoxSettings.tlsInsecure\n      },\n      fritzBoxSmartHome: fritzBoxSmartHomeSettings,\n      pushover: pushoverSettings\n'
);
replaceOnce(
  "src/diagnostic-export.ts",
  '      fritzBoxPresence: deps.presence.getStatus(),\n      climate: climateStatus,\n',
  '      fritzBoxPresence: deps.presence.getStatus(),\n      fritzBoxSmartHome: deps.fritzSmartHome.status(),\n      climate: climateStatus,\n'
);

replaceOnce(
  "src/main.ts",
  '  registerDiagnosticExportRoute(server, { registry, phoscon, hue, openCcu, presence, climate, vacation, homekit, saltaVersion: "0.8.133" });\n',
  '  registerDiagnosticExportRoute(server, { registry, phoscon, hue, openCcu, presence, fritzSmartHome, climate, vacation, homekit, saltaVersion: "0.8.133" });\n'
);

const diagnosticsTest = `import { describe, expect, it, vi } from "vitest";\nimport { readFileSync } from "node:fs";\nimport { FritzBoxSmartHomeAdapter, fritzBoxSmartHomeSafeErrorBody } from "./fritzbox-smarthome.js";\nimport type { Device, FritzBoxSmartHomeSettings } from "./types.js";\n\nconst enabled: FritzBoxSmartHomeSettings = { enabled: true, thermostats: true, outlets: false, lights: false, sensors: false };\nconst connection = { baseUrl: "http://fritz.box:49000", username: "user", password: "secret", enabled: false, pollIntervalSeconds: 30, absenceDelaySeconds: 300, tlsInsecure: false };\nconst registry = { all: () => [] as Device[], set: vi.fn(), get: vi.fn() } as never;\n\ndescribe("FRITZ!Box Smart Home diagnostics and login throttling", () => {\n  it("waits for AVM BlockTime before sending login credentials", async () => {\n    vi.useFakeTimers();\n    try {\n      const calls: string[] = [];\n      const request = vi.fn(async (url: string, method: string) => {\n        calls.push(\`${method} ${url}\`);\n        if (url.includes("login_sid.lua") && method === "GET") return { status: 200, headers: {}, text: "<SessionInfo><SID>0000000000000000</SID><Challenge>12345678</Challenge><BlockTime>2</BlockTime></SessionInfo>" };\n        if (url.includes("login_sid.lua") && method === "POST") return { status: 200, headers: {}, text: "<SessionInfo><SID>0123456789abcdef</SID><Challenge>unused</Challenge><BlockTime>0</BlockTime></SessionInfo>" };\n        if (url.endsWith("/api/v0/smarthome/overview")) return { status: 200, headers: {}, text: JSON.stringify({ devices: [], units: [] }) };\n        throw new Error(\`unexpected ${method} ${url}\`);\n      });\n      const adapter = new FritzBoxSmartHomeAdapter(registry, { loadSettings: async () => enabled, loadConnection: async () => connection, request, log: vi.fn(async () => undefined) });\n      const pending = adapter.reconcile();\n      await vi.advanceTimersByTimeAsync(1999);\n      expect(calls.filter(call => call.startsWith("POST "))).toHaveLength(0);\n      await vi.advanceTimersByTimeAsync(1);\n      await pending;\n      expect(calls.filter(call => call.startsWith("POST "))).toHaveLength(1);\n    } finally { vi.useRealTimers(); }\n  });\n\n  it("logs HTTP status, method, endpoint and a sanitized structured AVM error body", async () => {\n    const log = vi.fn(async () => undefined);\n    const request = vi.fn(async (url: string, method: string) => {\n      if (url.includes("login_sid.lua")) return { status: 200, headers: {}, text: "<SessionInfo><SID>0123456789abcdef</SID><Challenge>unused</Challenge><BlockTime>0</BlockTime></SessionInfo>" };\n      return { status: 400, headers: { "content-type": "application/json" }, text: JSON.stringify({ errors: [{ code: "INVALID_ARGUMENT", message: "bad request", username: "must-not-leak", sessionId: "must-not-leak" }] }) };\n    });\n    const adapter = new FritzBoxSmartHomeAdapter(registry, { loadSettings: async () => enabled, loadConnection: async () => connection, request, log });\n    await adapter.reconcile();\n    const warning = log.mock.calls.find(call => call[2] === "FRITZBOX_SMARTHOME_SYNC_FAILED");\n    expect(warning).toBeTruthy();\n    const details = warning?.[4] as Record<string, unknown>;\n    expect(details).toMatchObject({ error: "FRITZBOX_SMARTHOME_HTTP_400", status: 400, method: "GET", endpoint: "/smarthome/overview" });\n    expect(JSON.stringify(details.responseBody)).toContain("INVALID_ARGUMENT");\n    expect(JSON.stringify(details.responseBody)).not.toContain("must-not-leak");\n  });\n\n  it("never exposes secret fields from structured FRITZ!Box error responses", () => {\n    const safe = fritzBoxSmartHomeSafeErrorBody(JSON.stringify({ message: "invalid", password: "pw", authorization: "sid", nested: { token: "token", code: 12 } }));\n    expect(safe).toEqual({ message: "invalid", nested: { code: 12 } });\n  });\n\n  it("wires Smart Home settings and runtime status into the sanitized diagnostic export", () => {\n    const source = readFileSync(new URL("./diagnostic-export.ts", import.meta.url), "utf8");\n    const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");\n    expect(source).toContain("getFritzBoxSmartHomeSettings");\n    expect(source).toContain("fritzBoxSmartHome: fritzBoxSmartHomeSettings");\n    expect(source).toContain("fritzBoxSmartHome: deps.fritzSmartHome.status()");\n    expect(main).toContain("presence, fritzSmartHome, climate");\n  });\n});\n`;
write("src/fritzbox-smarthome-diagnostics.test.ts", diagnosticsTest);

replaceOnce(
  "scripts/validate-release.mjs",
  '  "src/fritzbox-presence.ts",\n',
  '  "src/fritzbox-presence.ts",\n  "src/fritzbox-smarthome.ts",\n'
);
replaceOnce(
  "scripts/validate-release.mjs",
  'const diagnosticExportSource = read("src/diagnostic-export.ts");\n',
  `const diagnosticExportSource = read("src/diagnostic-export.ts");\nconst fritzBoxSmartHomeSource = read("src/fritzbox-smarthome.ts");\nif (!fritzBoxSmartHomeSource.includes("await sleep(blockTime * 1000)") || !fritzBoxSmartHomeSource.includes("FritzBoxSmartHomeHttpError") || !fritzBoxSmartHomeSource.includes("responseBody: error.responseBody")) fail("FRITZ!Box Smart Home BlockTime/error diagnostics contract is incomplete");\nif (!diagnosticExportSource.includes("fritzBoxSmartHome: deps.fritzSmartHome.status()") || !diagnosticExportSource.includes("fritzBoxSmartHome: fritzBoxSmartHomeSettings")) fail("FRITZ!Box Smart Home diagnostic export wiring is incomplete");\n`
);

const changelog = read("CHANGELOG.md");
write("CHANGELOG.md", changelog.replace("# Changelog\n\n", `# Changelog\n\n## 0.8.133 - FRITZ!Box Smart Home connection diagnostics\n\n- Respect AVM login \`BlockTime\` instead of retrying credentials during the enforced login lockout.\n- Serialize concurrent Smart Home logins so reconciliation and connection tests cannot start duplicate login attempts.\n- Preserve HTTP status, method, REST endpoint and a sanitized structured AVM response body for Smart Home synchronization failures.\n- Add FRITZ!Box Smart Home settings and runtime status to the sanitized SALTA diagnostic export.\n- Keep credentials, authorization/session fields and other secret fields out of logs and diagnostic exports.\n- Keep the existing v0.8.132 opt-in defaults and imported devices unchanged.\n\n`));

write("RELEASE_TEXT.md", `# SALTA v0.8.133\n\nSALTA v0.8.133 improves FRITZ!Box Smart Home login handling and makes intermittent REST synchronization failures diagnosable without exposing credentials.\n\n## Changes\n\n- Respect the FRITZ!Box login \`BlockTime\` and wait until AVM allows the next credential submission.\n- Serialize concurrent Smart Home login attempts so periodic synchronization and manual connection tests cannot authenticate in parallel.\n- Record HTTP status, request method, Smart Home REST endpoint and a sanitized structured AVM error response when synchronization fails.\n- Add FRITZ!Box Smart Home opt-in settings and runtime connection status to the sanitized SALTA diagnostic export.\n- Strip credential, authorization, token and session fields from structured AVM error bodies before they reach the system log.\n- Keep non-JSON HTTP error responses limited to format/size metadata instead of logging arbitrary response text.\n\n## Root Cause\n\nSALTA v0.8.132 treated AVM's \`BlockTime\` as an immediate failure. The 30-second reconciliation cycle could therefore start another login attempt even while the FRITZ!Box explicitly prohibited additional attempts. AVM documents \`BlockTime\` as the number of seconds during which no further login attempt is allowed.\n\nThe production diagnostic also showed successful Smart Home synchronization followed by repeated HTTP 400 responses. v0.8.132 discarded the FRITZ!Box response body for non-2xx REST responses, so the actual AVM error details were unavailable for diagnosis. v0.8.133 preserves safe structured error details while deliberately avoiding an unproven protocol workaround for HTTP 400.\n\n## Compatibility\n\n- Existing FRITZ!Box Smart Home opt-in settings remain unchanged.\n- FRITZ!Box Smart Home remains disabled by default on new and upgraded installations unless explicitly enabled.\n- Existing imported FRITZ!Box devices remain unchanged.\n- Existing FRITZ!Box presence detection remains independent and unchanged.\n- No database schema change or manual migration is required.\n- Existing Shelly, Phoscon/deCONZ, Hue, OpenCCU, automation and HomeKit data remain unchanged.\n- No new npm dependency or mandatory environment variable is introduced.\n\n## Tests\n\n- Verify that no credential POST is sent before AVM \`BlockTime\` expires.\n- Verify that structured HTTP 400 error details retain status/method/endpoint while secret fields are removed.\n- Verify structured Smart Home error-body sanitization.\n- Verify Smart Home settings and runtime status are wired into the sanitized diagnostic export.\n- Release validator, JavaScript syntax checks, TypeScript build and the complete Vitest suite must pass before release.\n\n## Production update\n\n\`\`\`bash\ncd /opt/SALTA\ngit pull --ff-only origin main\ndocker compose --env-file .env -f docker-compose.image.yml config\ndocker compose --env-file .env -f docker-compose.image.yml pull\ndocker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans\ndocker compose --env-file .env -f docker-compose.image.yml ps\n\`\`\`\n\nDo not use \`docker compose down -v\` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.\n`);

console.log("Prepared SALTA v0.8.133 FRITZ!Box Smart Home diagnostics fix.");
