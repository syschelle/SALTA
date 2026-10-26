import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = path => readFileSync(path, "utf8");
const write = (path, value) => writeFileSync(path, value, "utf8");
function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(from, to);
}

// Keep the adapter independently testable: unit tests must not open a real PostgreSQL connection for logging.
let smartHomeAdapter = read("src/fritzbox-smarthome.ts");
smartHomeAdapter = replaceOnce(
  smartHomeAdapter,
  "  request?: RequestFunction;\n};",
  "  request?: RequestFunction;\n  log?: typeof writeSystemLog;\n};",
  "adapter log dependency"
);
smartHomeAdapter = replaceOnce(
  smartHomeAdapter,
  "  private readonly request: RequestFunction;",
  "  private readonly request: RequestFunction;\n  private readonly log: typeof writeSystemLog;",
  "adapter log property"
);
smartHomeAdapter = replaceOnce(
  smartHomeAdapter,
  "    this.request = dependencies.request ?? requestHttp;",
  "    this.request = dependencies.request ?? requestHttp;\n    this.log = dependencies.log ?? writeSystemLog;",
  "adapter log initialization"
);
smartHomeAdapter = smartHomeAdapter.replaceAll("await writeSystemLog(", "await this.log(");
write("src/fritzbox-smarthome.ts", smartHomeAdapter);

let smartHomeTest = read("src/fritzbox-smarthome.test.ts");
smartHomeTest = smartHomeTest.replaceAll(
  "      request\n    });",
  "      request,\n      log: vi.fn(async () => undefined)\n    });"
);
write("src/fritzbox-smarthome.test.ts", smartHomeTest);

// Types: independent, opt-in Smart Home settings/status.
let types = read("src/types.ts");
if (!types.includes("export interface FritzBoxSmartHomeSettings")) {
  types += [
    "",
    "export interface FritzBoxSmartHomeSettings {",
    "  enabled: boolean;",
    "  thermostats: boolean;",
    "  outlets: boolean;",
    "  lights: boolean;",
    "  sensors: boolean;",
    "}",
    "",
    "export interface FritzBoxSmartHomeStatus {",
    "  enabled: boolean;",
    "  connected: boolean;",
    "  deviceCount: number;",
    "  lastSync?: string;",
    "  lastError?: string;",
    "  api?: \"rest-v0\";",
    "}",
    ""
  ].join("\n");
}
write("src/types.ts", types);

// Persist only in the already-backed-up notification_state table. No schema version bump.
let db = read("src/db.ts");
db = replaceOnce(
  db,
  "FritzBoxPresenceSettings, GeneralSettings",
  "FritzBoxPresenceSettings, FritzBoxSmartHomeSettings, GeneralSettings",
  "db type import"
);
const dbAnchor = "\n\nexport async function getClimateModeSettings(): Promise<ClimateModeSettings> {";
const dbFunctions = [
  "",
  "",
  "export async function getFritzBoxSmartHomeSettings(): Promise<FritzBoxSmartHomeSettings> {",
  "  const result = await pool.query<{ details: Record<string, unknown> }>(",
  "    \"SELECT details FROM notification_state WHERE key='fritzbox-smarthome-settings'\"",
  "  );",
  "  const details = result.rows[0]?.details;",
  "  return {",
  "    enabled: details?.enabled === true,",
  "    thermostats: details?.thermostats === true,",
  "    outlets: details?.outlets === true,",
  "    lights: details?.lights === true,",
  "    sensors: details?.sensors === true",
  "  };",
  "}",
  "",
  "export async function updateFritzBoxSmartHomeSettings(input: FritzBoxSmartHomeSettings): Promise<FritzBoxSmartHomeSettings> {",
  "  const normalized: FritzBoxSmartHomeSettings = {",
  "    enabled: input.enabled === true,",
  "    thermostats: input.thermostats === true,",
  "    outlets: input.outlets === true,",
  "    lights: input.lights === true,",
  "    sensors: input.sensors === true",
  "  };",
  "  await pool.query(`INSERT INTO notification_state(key,details,updated_at) VALUES('fritzbox-smarthome-settings',$1::jsonb,now())",
  "    ON CONFLICT(key) DO UPDATE SET details=EXCLUDED.details,updated_at=now()`, [JSON.stringify(normalized)]);",
  "  return normalized;",
  "}",
  ""
].join("\n");
if (!db.includes("getFritzBoxSmartHomeSettings")) db = replaceOnce(db, dbAnchor, `${dbFunctions}${dbAnchor}`, "db smart-home settings insertion");
write("src/db.ts", db);

// Runtime wiring keeps presence and Smart Home separate.
let main = read("src/main.ts");
main = replaceOnce(
  main,
  'import { FritzBoxPresenceAdapter } from "./fritzbox-presence.js";',
  'import { FritzBoxPresenceAdapter } from "./fritzbox-presence.js";\nimport { FritzBoxSmartHomeAdapter, registerFritzBoxSmartHomeRoutes } from "./fritzbox-smarthome.js";',
  "main smart-home import"
);
main = replaceOnce(
  main,
  "  const presence = new FritzBoxPresenceAdapter(registry);",
  "  const presence = new FritzBoxPresenceAdapter(registry);\n  const fritzSmartHome = new FritzBoxSmartHomeAdapter(registry);",
  "main adapter construction"
);
main = replaceOnce(
  main,
  "    { shelly, phoscon, hue, openccu: openCcu, virtual },",
  "    { shelly, phoscon, hue, openccu: openCcu, virtual, fritzbox: fritzSmartHome },",
  "main command router"
);
main = replaceOnce(
  main,
  "  presence.start();\n  batteryMonitor.start();",
  "  presence.start();\n  fritzSmartHome.start();\n  batteryMonitor.start();",
  "main start"
);
main = replaceOnce(
  main,
  "  const server = buildServer(registry, shelly, phoscon, openCcu, virtual, commands, automations, presence, climate, batteryMonitor, () => process.kill(process.pid, \"SIGTERM\"), homekit, hue, vacation);",
  "  const server = buildServer(registry, shelly, phoscon, openCcu, virtual, commands, automations, presence, climate, batteryMonitor, () => process.kill(process.pid, \"SIGTERM\"), homekit, hue, vacation);\n  registerFritzBoxSmartHomeRoutes(server, fritzSmartHome);",
  "main route registration"
);
main = replaceOnce(
  main,
  "    presence.stop();\n    openCcuDutyCycle.stop();",
  "    presence.stop();\n    fritzSmartHome.stop();\n    openCcuDutyCycle.stop();",
  "main stop"
);
write("src/main.ts", main);

// Serve the additional browser module through the authenticated static app.
let server = read("src/server.ts");
server = replaceOnce(
  server,
  '["/app.js", "app.js"],',
  '["/app.js", "app.js"],\n    ["/fritzbox-smarthome.js", "fritzbox-smarthome.js"],',
  "server static file map"
);
write("src/server.ts", server);

// Add a separate Smart Home panel next to FRITZ!Box presence. All switches are unchecked.
let index = read("public/index.html");
if (!index.includes('id="fritzSmartHomeSettingsForm"')) {
  const formStart = index.indexOf('<form id="presenceSettingsForm"');
  if (formStart < 0) throw new Error("presence settings form not found");
  const formEnd = index.indexOf("</form>", formStart);
  if (formEnd < 0) throw new Error("presence settings form end not found");
  const insertAt = formEnd + "</form>".length;
  const block = [
    "",
    '        <section class="panel fritz-smarthome-settings" aria-labelledby="fritzSmartHomeTitle">',
    '          <div class="section-head"><div><h2 id="fritzSmartHomeTitle"><span class="mdi mdi-home-thermometer-outline" aria-hidden="true"></span> FRITZ!Box Smart Home</h2><p class="muted">Optional. Ohne Aktivierung werden keine Smart-Home-Geräte abgefragt oder angelegt.</p></div></div>',
    '          <div id="fritzSmartHomeStatus" class="gateway-status" aria-live="polite">Deaktiviert – keine FRITZ!Box-Smart-Home-Geräte werden abgefragt.</div>',
    '          <form id="fritzSmartHomeSettingsForm" class="page-form">',
    '            <label class="presence-enabled-row"><span><strong>Smart-Home-Geräte einbinden</strong><small>Getrennt von der Präsenzerkennung und standardmäßig deaktiviert.</small></span><input id="fritzSmartHomeEnabled" type="checkbox"></label>',
    '            <div class="page-form-grid">',
    '              <label class="presence-enabled-row"><span><strong>Heizkörperregler</strong><small>Temperatur und Solltemperatur</small></span><input id="fritzSmartHomeThermostats" type="checkbox" disabled></label>',
    '              <label class="presence-enabled-row"><span><strong>Steckdosen / Schalter</strong><small>Schaltzustand und Steuerung</small></span><input id="fritzSmartHomeOutlets" type="checkbox" disabled></label>',
    '              <label class="presence-enabled-row"><span><strong>Leuchten</strong><small>Ein/Aus und Helligkeit, soweit unterstützt</small></span><input id="fritzSmartHomeLights" type="checkbox" disabled></label>',
    '              <label class="presence-enabled-row"><span><strong>Sensoren</strong><small>Temperatur und Luftfeuchte, soweit verfügbar</small></span><input id="fritzSmartHomeSensors" type="checkbox" disabled></label>',
    "            </div>",
    '            <div class="form-actions"><button type="submit"><span class="mdi mdi-content-save-outline" aria-hidden="true"></span>Speichern</button><button id="fritzSmartHomeTestButton" class="secondary" type="button"><span class="mdi mdi-lan-connect" aria-hidden="true"></span>Verbindung testen</button><button id="fritzSmartHomeRefreshButton" class="secondary" type="button"><span class="mdi mdi-sync" aria-hidden="true"></span>Synchronisieren</button></div>',
    "          </form>",
    "        </section>"
  ].join("\n");
  index = index.slice(0, insertAt) + block + index.slice(insertAt);
}
if (!index.includes('/fritzbox-smarthome.js')) {
  const appScript = /<script\s+src="\/app\.js"[^>]*><\/script>/;
  const match = index.match(appScript);
  if (!match) throw new Error("app.js script tag not found");
  index = index.replace(appScript, `${match[0]}\n<script src="/fritzbox-smarthome.js"></script>`);
}
write("public/index.html", index);

// Common device rendering should label this independent source explicitly.
let app = read("public/app.js");
app = replaceOnce(
  app,
  "virtual:'Virtuell',presence:'Präsenz',system:'SALTA'",
  "virtual:'Virtuell',fritzbox:'FRITZ!Box',presence:'Präsenz',system:'SALTA'",
  "frontend source label"
);
write("public/app.js", app);

// English translations; German source strings remain canonical.
const en = JSON.parse(read("public/i18n/en.json"));
en.phrases ??= {};
Object.assign(en.phrases, {
  "FRITZ!Box Smart Home": "FRITZ!Box Smart Home",
  "Optional. Ohne Aktivierung werden keine Smart-Home-Geräte abgefragt oder angelegt.": "Optional. No smart-home devices are queried or created until enabled.",
  "Deaktiviert – keine FRITZ!Box-Smart-Home-Geräte werden abgefragt.": "Disabled – no FRITZ!Box smart-home devices are queried.",
  "Smart-Home-Geräte einbinden": "Include smart-home devices",
  "Getrennt von der Präsenzerkennung und standardmäßig deaktiviert.": "Separate from presence detection and disabled by default.",
  "Heizkörperregler": "Radiator controls",
  "Temperatur und Solltemperatur": "Temperature and target temperature",
  "Steckdosen / Schalter": "Outlets / switches",
  "Schaltzustand und Steuerung": "Switch state and control",
  "Leuchten": "Lights",
  "Ein/Aus und Helligkeit, soweit unterstützt": "On/off and brightness where supported",
  "Sensoren": "Sensors",
  "Temperatur und Luftfeuchte, soweit verfügbar": "Temperature and humidity where available",
  "FRITZ!Box Smart Home gespeichert.": "FRITZ!Box Smart Home saved.",
  "FRITZ!Box Smart Home verbunden.": "FRITZ!Box Smart Home connected.",
  "FRITZ!Box Smart Home konnte nicht verbunden werden.": "FRITZ!Box Smart Home could not connect.",
  "FRITZ!Box Smart Home synchronisiert.": "FRITZ!Box Smart Home synchronized.",
  "Geräte eingebunden": "devices included",
  "Nicht verbunden": "Not connected",
  "Noch nicht synchronisiert": "Not synchronized yet"
});
write("public/i18n/en.json", `${JSON.stringify(en, null, 2)}\n`);

// Add the new browser module to syntax validation.
const packageJson = JSON.parse(read("package.json"));
if (!packageJson.scripts.check.includes("public/fritzbox-smarthome.js")) {
  packageJson.scripts.check = packageJson.scripts.check.replace(
    "node --check public/i18n.js",
    "node --check public/fritzbox-smarthome.js && node --check public/i18n.js"
  );
  write("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
}

// Release contract. Use simple string checks so the generator itself contains no nested templates.
let validator = read("scripts/validate-release.mjs");
const contract = [
  "",
  'const fritzSmartHomeSource = read("src/fritzbox-smarthome.ts");',
  'const fritzSmartHomeFrontend = read("public/fritzbox-smarthome.js");',
  'if (!fritzSmartHomeSource.includes("if (!settings.enabled)") || !fritzSmartHomeSource.includes("homekitEnabled: false")) fail("FRITZ!Box Smart Home must remain opt-in and HomeKit-off by default");',
  'if (!fritzSmartHomeSource.includes("/api/v0") || !fritzSmartHomeSource.includes("AVM-SID")) fail("FRITZ!Box Smart Home REST transport contract is missing");',
  'if (!fritzSmartHomeSource.includes("setPointTemperature: { mode: \\"temperature\\", celsius: value }") || !fritzSmartHomeSource.includes("onOffInterface: { active }")) fail("FRITZ!Box Smart Home command mappings are incomplete");',
  'if (!read("src/db.ts").includes("WHERE key=\'fritzbox-smarthome-settings\'") || !read("src/db.ts").includes("export const DATABASE_SCHEMA_VERSION = \\"0.5\\"")) fail("FRITZ!Box Smart Home settings must use existing notification_state without a schema bump");',
  'if (!read("src/main.ts").includes("fritzbox: fritzSmartHome") || !read("src/main.ts").includes("registerFritzBoxSmartHomeRoutes(server, fritzSmartHome)")) fail("FRITZ!Box Smart Home runtime wiring is missing");',
  'for (const id of ["fritzSmartHomeEnabled","fritzSmartHomeThermostats","fritzSmartHomeOutlets","fritzSmartHomeLights","fritzSmartHomeSensors"]) if (!read("public/index.html").includes("id=\\\"" + id + "\\\"")) fail("FRITZ!Box Smart Home option is missing: " + id);',
  'if (!fritzSmartHomeFrontend.includes("api(\'/api/fritzbox/smarthome/settings\'") || fritzSmartHomeFrontend.includes("password")) fail("FRITZ!Box Smart Home frontend must use the authenticated SALTA API without credentials");',
  'if (!read("src/server.ts").includes("[\\\"/fritzbox-smarthome.js\\\", \\\"fritzbox-smarthome.js\\\"]")) fail("FRITZ!Box Smart Home browser module is not served");',
  ""
].join("\n");
if (!validator.includes("const fritzSmartHomeSource")) validator += contract;
write("scripts/validate-release.mjs", validator);

// Documentation before canonical version bump.
let readme = read("README.md");
if (!readme.includes("## FRITZ!Box Smart Home")) {
  readme += [
    "",
    "",
    "## FRITZ!Box Smart Home",
    "",
    "SALTA can optionally import compatible FRITZ!Box Smart Home units through the local Smart Home REST API. The integration is independent from FRITZ!Box presence detection and is disabled by default on both new and upgraded installations. Nothing is queried or imported until the Smart Home master switch is explicitly enabled. Radiator controls, outlets/switches, lights and temperature/humidity sensors can be enabled per category. Newly imported FRITZ!Box devices are not exposed to HomeKit automatically.",
    ""
  ].join("\n");
}
write("README.md", readme);

// Bump all established release/version surfaces through SALTA's canonical tool.
execFileSync(process.execPath, ["scripts/set-version.mjs", "0.8.132"], { stdio: "inherit" });

let changelog = read("CHANGELOG.md");
const changelogEntry = [
  "## 0.8.132 - Optional FRITZ!Box Smart Home integration",
  "",
  "- Added an independent FRITZ!Box Smart Home adapter based on the local Smart Home REST API.",
  "- Added explicit master and per-category opt-ins for radiator controls, outlets/switches, lights and temperature/humidity sensors; every new option defaults to disabled.",
  "- Reused the existing FRITZ!Box connection credentials without coupling Smart Home enablement to presence detection.",
  "- Imported FRITZ!Box devices use their own `fritzbox` source and start with HomeKit exposure disabled.",
  "- Added direct target-temperature, on/off/toggle and brightness commands for documented REST interfaces.",
  "- Kept database schema version 0.5 unchanged by storing Smart Home opt-in state in the already-backed-up `notification_state` table.",
  "- Added regression coverage proving that disabled Smart Home performs no network access and creates no devices.",
  "",
  ""
].join("\n");
if (!changelog.includes("## 0.8.132 -")) changelog = replaceOnce(changelog, "# Changelog\n\n", `# Changelog\n\n${changelogEntry}`, "changelog header");
write("CHANGELOG.md", changelog);

const releaseText = [
  "# SALTA v0.8.132",
  "",
  "SALTA v0.8.132 adds an optional FRITZ!Box Smart Home integration while preserving the behavior of every existing installation by default.",
  "",
  "## Changes",
  "",
  "- Add an independent FRITZ!Box Smart Home adapter using the local Smart Home REST API.",
  "- Add an explicit master switch plus separate opt-ins for radiator controls, outlets/switches, lights and temperature/humidity sensors.",
  "- Keep the master switch and every category disabled by default on new and upgraded installations.",
  "- Reuse the existing FRITZ!Box host, credentials and TLS settings without tying Smart Home enablement to presence detection.",
  "- Map documented thermostat, on/off, level, temperature and humidity interfaces into SALTA devices.",
  "- Support target-temperature commands for FRITZ! thermostats, on/off/toggle for switchable units and brightness for supported lights.",
  "- Keep newly imported FRITZ!Box Smart Home devices out of HomeKit until the user explicitly enables HomeKit for that device.",
  "- Store the Smart Home opt-in in the existing backed-up notification-state store; no database schema version change is required.",
  "",
  "## Root Cause / Motivation",
  "",
  "SALTA already used FRITZ!Box TR-064 for optional WLAN presence detection, but that adapter intentionally represented people/presence rather than FRITZ!Box Smart Home actuators and sensors. Mixing both concerns would make upgrades risky and could silently introduce devices into established systems.",
  "",
  "v0.8.132 therefore adds Smart Home as a separate opt-in adapter. When the new master switch is disabled, the adapter exits before authentication or REST requests and does not create or modify FRITZ!Box Smart Home devices. This makes the new capability safe for existing installations while allowing a new installation to enable only the desired device categories.",
  "",
  "## Compatibility",
  "",
  "- Existing SALTA installations remain unchanged unless FRITZ!Box Smart Home is explicitly enabled.",
  "- Existing FRITZ!Box presence settings and behavior remain independent and unchanged.",
  "- Database schema version remains 0.5; no ALTER TABLE or manual migration is required.",
  "- Existing Shelly, Phoscon/deCONZ, Hue, OpenCCU, virtual-device, automation and HomeKit data remain unchanged.",
  "- Existing PostgreSQL, SALTA runtime and HomeKit volumes remain compatible.",
  "- FRITZ!Box Smart Home REST support requires a FRITZ!OS version that provides the Smart Home REST API.",
  "- No new npm dependency or mandatory environment variable is introduced.",
  "",
  "## Tests",
  "",
  "- Verify all FRITZ!Box Smart Home opt-ins default to false.",
  "- Verify the disabled adapter performs no FRITZ!Box network request and creates no devices.",
  "- Verify thermostat, outlet, light and sensor REST-interface mapping.",
  "- Verify newly imported devices default to HomeKit disabled.",
  "- Verify per-category opt-ins.",
  "- Verify PBKDF2 Session-ID response generation and TR-064-to-web-origin normalization.",
  "- Verify the thermostat REST command payload.",
  "- Verify the browser UI exposes unchecked opt-in controls and never embeds FRITZ!Box credentials.",
  "- Verify database schema version 0.5 remains unchanged and the existing notification-state persistence is used.",
  "",
  "## Production update",
  "",
  "```bash",
  "cd /opt/SALTA",
  "git pull --ff-only origin main",
  "docker compose --env-file .env -f docker-compose.image.yml config",
  "docker compose --env-file .env -f docker-compose.image.yml pull",
  "docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans",
  "docker compose --env-file .env -f docker-compose.image.yml ps",
  "```",
  "",
  "Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.",
  ""
].join("\n");
write("RELEASE_TEXT.md", releaseText);

let migration = read("MIGRATION_PATH.md");
const heading = "## Current v0.8.132 update\n\n";
if (migration.includes(heading) && !migration.includes("FRITZ!Box Smart Home is additive")) {
  migration = migration.replace(
    heading,
    `${heading}FRITZ!Box Smart Home is additive and disabled by default. Its opt-in state uses the existing backed-up notification_state table, so v0.8.132 requires no schema migration and does not import devices unless explicitly enabled.\n\n`
  );
}
write("MIGRATION_PATH.md", migration);

console.log("Prepared SALTA v0.8.132 FRITZ!Box Smart Home integration.");
