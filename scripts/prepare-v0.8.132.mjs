import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = path => readFileSync(path, "utf8");
const write = (path, value) => writeFileSync(path, value, "utf8");
function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(from, to);
}

// Types: independent, opt-in Smart Home settings/status.
let types = read("src/types.ts");
if (!types.includes("export interface FritzBoxSmartHomeSettings")) {
  types += `\nexport interface FritzBoxSmartHomeSettings {\n  enabled: boolean;\n  thermostats: boolean;\n  outlets: boolean;\n  lights: boolean;\n  sensors: boolean;\n}\n\nexport interface FritzBoxSmartHomeStatus {\n  enabled: boolean;\n  connected: boolean;\n  deviceCount: number;\n  lastSync?: string;\n  lastError?: string;\n  api?: \"rest-v0\";\n}\n`;
}
write("src/types.ts", types);

// Persist only in the already-backed-up notification_state table. No schema version bump.
let db = read("src/db.ts");
db = replaceOnce(db,
  "FritzBoxPresenceSettings, GeneralSettings",
  "FritzBoxPresenceSettings, FritzBoxSmartHomeSettings, GeneralSettings",
  "db type import");
const dbAnchor = "\n\nexport async function getClimateModeSettings(): Promise<ClimateModeSettings> {";
const dbFunctions = `\n\nexport async function getFritzBoxSmartHomeSettings(): Promise<FritzBoxSmartHomeSettings> {\n  const result = await pool.query<{ details: Record<string, unknown> }>(\n    \"SELECT details FROM notification_state WHERE key='fritzbox-smarthome-settings'\"\n  );\n  const details = result.rows[0]?.details;\n  return {\n    enabled: details?.enabled === true,\n    thermostats: details?.thermostats === true,\n    outlets: details?.outlets === true,\n    lights: details?.lights === true,\n    sensors: details?.sensors === true\n  };\n}\n\nexport async function updateFritzBoxSmartHomeSettings(input: FritzBoxSmartHomeSettings): Promise<FritzBoxSmartHomeSettings> {\n  const normalized: FritzBoxSmartHomeSettings = {\n    enabled: input.enabled === true,\n    thermostats: input.thermostats === true,\n    outlets: input.outlets === true,\n    lights: input.lights === true,\n    sensors: input.sensors === true\n  };\n  await pool.query(\`INSERT INTO notification_state(key,details,updated_at) VALUES('fritzbox-smarthome-settings',$1::jsonb,now())\n    ON CONFLICT(key) DO UPDATE SET details=EXCLUDED.details,updated_at=now()\`, [JSON.stringify(normalized)]);\n  return normalized;\n}\n`;
if (!db.includes("getFritzBoxSmartHomeSettings")) db = replaceOnce(db, dbAnchor, `${dbFunctions}${dbAnchor}`, "db smart-home settings insertion");
write("src/db.ts", db);

// Runtime wiring keeps presence and Smart Home separate.
let main = read("src/main.ts");
main = replaceOnce(main,
  'import { FritzBoxPresenceAdapter } from "./fritzbox-presence.js";',
  'import { FritzBoxPresenceAdapter } from "./fritzbox-presence.js";\nimport { FritzBoxSmartHomeAdapter, registerFritzBoxSmartHomeRoutes } from "./fritzbox-smarthome.js";',
  "main smart-home import");
main = replaceOnce(main,
  "  const presence = new FritzBoxPresenceAdapter(registry);",
  "  const presence = new FritzBoxPresenceAdapter(registry);\n  const fritzSmartHome = new FritzBoxSmartHomeAdapter(registry);",
  "main adapter construction");
main = replaceOnce(main,
  "    { shelly, phoscon, hue, openccu: openCcu, virtual },",
  "    { shelly, phoscon, hue, openccu: openCcu, virtual, fritzbox: fritzSmartHome },",
  "main command router");
main = replaceOnce(main,
  "  presence.start();\n  batteryMonitor.start();",
  "  presence.start();\n  fritzSmartHome.start();\n  batteryMonitor.start();",
  "main start");
main = replaceOnce(main,
  "  const server = buildServer(registry, shelly, phoscon, openCcu, virtual, commands, automations, presence, climate, batteryMonitor, () => process.kill(process.pid, \"SIGTERM\"), homekit, hue, vacation);",
  "  const server = buildServer(registry, shelly, phoscon, openCcu, virtual, commands, automations, presence, climate, batteryMonitor, () => process.kill(process.pid, \"SIGTERM\"), homekit, hue, vacation);\n  registerFritzBoxSmartHomeRoutes(server, fritzSmartHome);",
  "main route registration");
main = replaceOnce(main,
  "    presence.stop();\n    openCcuDutyCycle.stop();",
  "    presence.stop();\n    fritzSmartHome.stop();\n    openCcuDutyCycle.stop();",
  "main stop");
write("src/main.ts", main);

// Serve the additional browser module through the same authenticated static app.
let server = read("src/server.ts");
server = replaceOnce(server,
  '["/app.js", "app.js"],',
  '["/app.js", "app.js"],\n    ["/fritzbox-smarthome.js", "fritzbox-smarthome.js"],',
  "server static file map");
write("src/server.ts", server);

// FRITZ!Box Smart Home is configured next to presence, but has an independent master opt-in.
let index = read("public/index.html");
if (!index.includes('id="fritzSmartHomeSettingsForm"')) {
  const formStart = index.indexOf('<form id="presenceSettingsForm"');
  if (formStart < 0) throw new Error("presence settings form not found");
  const formEnd = index.indexOf("</form>", formStart);
  if (formEnd < 0) throw new Error("presence settings form end not found");
  const insertAt = formEnd + "</form>".length;
  const block = `\n        <section class="panel fritz-smarthome-settings" aria-labelledby="fritzSmartHomeTitle">\n          <div class="section-head"><div><h2 id="fritzSmartHomeTitle"><span class="mdi mdi-home-thermometer-outline" aria-hidden="true"></span> FRITZ!Box Smart Home</h2><p class="muted">Optional. Ohne Aktivierung werden keine Smart-Home-Geräte abgefragt oder angelegt.</p></div></div>\n          <div id="fritzSmartHomeStatus" class="gateway-status" aria-live="polite">Deaktiviert – keine FRITZ!Box-Smart-Home-Geräte werden abgefragt.</div>\n          <form id="fritzSmartHomeSettingsForm" class="page-form">\n            <label class="presence-enabled-row"><span><strong>Smart-Home-Geräte einbinden</strong><small>Getrennt von der Präsenzerkennung und standardmäßig deaktiviert.</small></span><input id="fritzSmartHomeEnabled" type="checkbox"></label>\n            <div class="page-form-grid">\n              <label class="presence-enabled-row"><span><strong>Heizkörperregler</strong><small>Temperatur und Solltemperatur</small></span><input id="fritzSmartHomeThermostats" type="checkbox" disabled></label>\n              <label class="presence-enabled-row"><span><strong>Steckdosen / Schalter</strong><small>Schaltzustand und Steuerung</small></span><input id="fritzSmartHomeOutlets" type="checkbox" disabled></label>\n              <label class="presence-enabled-row"><span><strong>Leuchten</strong><small>Ein/Aus und Helligkeit, soweit unterstützt</small></span><input id="fritzSmartHomeLights" type="checkbox" disabled></label>\n              <label class="presence-enabled-row"><span><strong>Sensoren</strong><small>Temperatur und Luftfeuchte, soweit verfügbar</small></span><input id="fritzSmartHomeSensors" type="checkbox" disabled></label>\n            </div>\n            <div class="form-actions"><button type="submit"><span class="mdi mdi-content-save-outline" aria-hidden="true"></span>Speichern</button><button id="fritzSmartHomeTestButton" class="secondary" type="button"><span class="mdi mdi-lan-connect" aria-hidden="true"></span>Verbindung testen</button><button id="fritzSmartHomeRefreshButton" class="secondary" type="button"><span class="mdi mdi-sync" aria-hidden="true"></span>Synchronisieren</button></div>\n          </form>\n        </section>`;
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
app = replaceOnce(app,
  "virtual:'Virtuell',presence:'Präsenz',system:'SALTA'",
  "virtual:'Virtuell',fritzbox:'FRITZ!Box',presence:'Präsenz',system:'SALTA'",
  "frontend source label");
write("public/app.js", app);

// English UI translations; German source strings remain canonical.
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

// Add the new browser module to syntax validation before the normal release checks.
const packageJson = JSON.parse(read("package.json"));
if (!packageJson.scripts.check.includes("public/fritzbox-smarthome.js")) {
  packageJson.scripts.check = packageJson.scripts.check.replace("node --check public/i18n.js", "node --check public/fritzbox-smarthome.js && node --check public/i18n.js");
  write("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
}

// Release contract: opt-in means all defaults false and no schema migration.
let validator = read("scripts/validate-release.mjs");
const contract = `\nconst fritzSmartHomeSource = read("src/fritzbox-smarthome.ts");\nconst fritzSmartHomeFrontend = read("public/fritzbox-smarthome.js");\nif (!fritzSmartHomeSource.includes('if (!settings.enabled)') || !fritzSmartHomeSource.includes('homekitEnabled: false')) fail("FRITZ!Box Smart Home must remain opt-in and HomeKit-off by default");\nif (!fritzSmartHomeSource.includes('/api/v0') || !fritzSmartHomeSource.includes('authorization: \\`AVM-SID \\${this.sid}\\`')) fail("FRITZ!Box Smart Home REST transport contract is missing");\nif (!fritzSmartHomeSource.includes('setPointTemperature: { mode: "temperature", celsius: value }') || !fritzSmartHomeSource.includes('onOffInterface: { active }')) fail("FRITZ!Box Smart Home command mappings are incomplete");\nif (!read("src/db.ts").includes("WHERE key='fritzbox-smarthome-settings'") || !read("src/db.ts").includes('export const DATABASE_SCHEMA_VERSION = "0.5"')) fail("FRITZ!Box Smart Home settings must use existing notification_state without a schema bump");\nif (!read("src/main.ts").includes('fritzbox: fritzSmartHome') || !read("src/main.ts").includes('registerFritzBoxSmartHomeRoutes(server, fritzSmartHome)')) fail("FRITZ!Box Smart Home runtime wiring is missing");\nfor (const id of ['fritzSmartHomeEnabled','fritzSmartHomeThermostats','fritzSmartHomeOutlets','fritzSmartHomeLights','fritzSmartHomeSensors']) if (!read("public/index.html").includes(\\`id="\\${id}"\\`)) fail(\\`FRITZ!Box Smart Home option is missing: \\${id}\\`);\nif (!fritzSmartHomeFrontend.includes("api('/api/fritzbox/smarthome/settings'") || fritzSmartHomeFrontend.includes('password')) fail("FRITZ!Box Smart Home frontend must use the authenticated SALTA API without credentials");\nif (!read("src/server.ts").includes('["/fritzbox-smarthome.js", "fritzbox-smarthome.js"]')) fail("FRITZ!Box Smart Home browser module is not served");\n`;
if (!validator.includes("const fritzSmartHomeSource")) validator += contract;
write("scripts/validate-release.mjs", validator);

// Documentation before version bump.
let readme = read("README.md");
if (!readme.includes("## FRITZ!Box Smart Home")) readme += `\n\n## FRITZ!Box Smart Home\n\nSALTA can optionally import compatible FRITZ!Box Smart Home units through the local Smart Home REST API. The integration is independent from FRITZ!Box presence detection and is disabled by default on both new and upgraded installations. Nothing is queried or imported until the Smart Home master switch is explicitly enabled. Radiator controls, outlets/switches, lights and temperature/humidity sensors can be enabled per category. Newly imported FRITZ!Box devices are not exposed to HomeKit automatically.\n`;
write("README.md", readme);

// Bump active release surfaces using the repository's canonical version tool.
execFileSync(process.execPath, ["scripts/set-version.mjs", "0.8.132"], { stdio: "inherit" });

let changelog = read("CHANGELOG.md");
const changelogEntry = `## 0.8.132 - Optional FRITZ!Box Smart Home integration\n\n- Added an independent FRITZ!Box Smart Home adapter based on the local Smart Home REST API.\n- Added explicit master and per-category opt-ins for radiator controls, outlets/switches, lights and temperature/humidity sensors; every new option defaults to disabled.\n- Reused the existing FRITZ!Box connection credentials without coupling Smart Home enablement to presence detection.\n- Imported FRITZ!Box devices use their own \\`fritzbox\\` source and start with HomeKit exposure disabled.\n- Added direct target-temperature, on/off/toggle and brightness commands for documented REST interfaces.\n- Kept database schema version 0.5 unchanged by storing Smart Home opt-in state in the already-backed-up \\`notification_state\\` table.\n- Added regression coverage proving that disabled Smart Home performs no network access and creates no devices.\n\n`;
if (!changelog.includes("## 0.8.132 -")) changelog = replaceOnce(changelog, "# Changelog\n\n", `# Changelog\n\n${changelogEntry}`, "changelog header");
write("CHANGELOG.md", changelog);

write("RELEASE_TEXT.md", `# SALTA v0.8.132\n\nSALTA v0.8.132 adds an optional FRITZ!Box Smart Home integration while preserving the behavior of every existing installation by default.\n\n## Changes\n\n- Add an independent FRITZ!Box Smart Home adapter using the local Smart Home REST API.\n- Add an explicit master switch plus separate opt-ins for radiator controls, outlets/switches, lights and temperature/humidity sensors.\n- Keep the master switch and every category disabled by default on new and upgraded installations.\n- Reuse the existing FRITZ!Box host, credentials and TLS settings without tying Smart Home enablement to presence detection.\n- Map documented thermostat, on/off, level, temperature and humidity interfaces into SALTA devices.\n- Support target-temperature commands for FRITZ! thermostats, on/off/toggle for switchable units and brightness for supported lights.\n- Keep newly imported FRITZ!Box Smart Home devices out of HomeKit until the user explicitly enables HomeKit for that device.\n- Store the Smart Home opt-in in the existing backed-up notification-state store; no database schema version change is required.\n\n## Root Cause / Motivation\n\nSALTA already used FRITZ!Box TR-064 for optional WLAN presence detection, but that adapter intentionally represented people/presence rather than FRITZ!Box Smart Home actuators and sensors. Mixing both concerns would make upgrades risky and could silently introduce devices into established systems.\n\nv0.8.132 therefore adds Smart Home as a separate opt-in adapter. When the new master switch is disabled, the adapter exits before authentication or REST requests and does not create or modify FRITZ!Box Smart Home devices. This makes the new capability safe for existing installations while allowing a new installation to enable only the desired device categories.\n\n## Compatibility\n\n- Existing SALTA installations remain unchanged unless FRITZ!Box Smart Home is explicitly enabled.\n- Existing FRITZ!Box presence settings and behavior remain independent and unchanged.\n- Database schema version remains 0.5; no ALTER TABLE or manual migration is required.\n- Existing Shelly, Phoscon/deCONZ, Hue, OpenCCU, virtual-device, automation and HomeKit data remain unchanged.\n- Existing PostgreSQL, SALTA runtime and HomeKit volumes remain compatible.\n- FRITZ!Box Smart Home REST support requires a FRITZ!OS version that provides the Smart Home REST API.\n- No new npm dependency or mandatory environment variable is introduced.\n\n## Tests\n\n- Verify all FRITZ!Box Smart Home opt-ins default to false.\n- Verify the disabled adapter performs no FRITZ!Box network request and creates no devices.\n- Verify thermostat, outlet, light and sensor REST-interface mapping.\n- Verify newly imported devices default to HomeKit disabled.\n- Verify per-category opt-ins.\n- Verify PBKDF2 Session-ID response generation and TR-064-to-web-origin normalization.\n- Verify the thermostat REST command payload.\n- Verify the browser UI exposes unchecked opt-in controls and never embeds FRITZ!Box credentials.\n- Verify database schema version 0.5 remains unchanged and the existing notification-state persistence is used.\n\n## Production update\n\n\\`\\`\\`bash\ncd /opt/SALTA\ngit pull --ff-only origin main\ndocker compose --env-file .env -f docker-compose.image.yml config\ndocker compose --env-file .env -f docker-compose.image.yml pull\ndocker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans\ndocker compose --env-file .env -f docker-compose.image.yml ps\n\\`\\`\\`\n\nDo not use \\`docker compose down -v\\` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.\n`);

let migration = read("MIGRATION_PATH.md");
const heading = "## Current v0.8.132 update\n\n";
if (migration.includes(heading) && !migration.includes("FRITZ!Box Smart Home is additive")) migration = migration.replace(heading, `${heading}FRITZ!Box Smart Home is additive and disabled by default. Its opt-in state uses the existing backed-up notification_state table, so v0.8.132 requires no schema migration and does not import devices unless explicitly enabled.\n\n`);
write("MIGRATION_PATH.md", migration);

console.log("Prepared SALTA v0.8.132 FRITZ!Box Smart Home integration.");
