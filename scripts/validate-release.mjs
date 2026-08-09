import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const fail = (message) => {
  throw new Error(`Release validation failed: ${message}`);
};

const requiredReleaseFiles = [
  "scripts/check-test-symbols.mjs",
  "tsconfig.tests.json",
  "src/automations.ts",
  "src/automation-persistence.ts",
  "src/phoscon-adapter.ts",
  "src/phoscon-core.ts",
  "src/fritzbox-presence.ts",
  "src/frontend-presence.test.ts",
  "public/automation-ui.js",
];
for (const file of requiredReleaseFiles) {
  if (!existsSync(resolve(root, file))) fail(`required release file is missing: ${file}`);
}

const publicIndex = read("public/index.html");
const roomGroupingScript = '<script src="/room-grouping.js"></script>';
const automationUiScript = '<script src="/automation-ui.js"></script>';
const appScript = '<script src="/app.js"></script>';
if (!publicIndex.includes(roomGroupingScript)) fail("public/index.html does not load room-grouping.js");
if (!publicIndex.includes(automationUiScript)) fail("public/index.html does not load automation-ui.js");
if (publicIndex.indexOf(roomGroupingScript) > publicIndex.indexOf(appScript)) fail("room-grouping.js must load before app.js");
if (publicIndex.indexOf(automationUiScript) > publicIndex.indexOf(appScript)) fail("automation-ui.js must load before app.js");
const serverSource = read("src/server.ts");
if (!serverSource.includes('["/room-grouping.js", "room-grouping.js"]')) fail("server does not serve room-grouping.js");
if (!serverSource.includes('["/automation-ui.js", "automation-ui.js"]')) fail("server does not serve automation-ui.js");
if (!serverSource.includes('immutableVendorAsset ? "public, max-age=31536000, immutable" : "no-store"')) fail("application assets are not protected from stale browser caching");


const virtualFrontend = read("public/app.js");
if (!publicIndex.includes('data-nav="virtual"')) fail("Virtual Devices navigation is missing");
if (!publicIndex.includes('data-page="virtual"')) fail("Virtual Devices page is missing");
if (!virtualFrontend.includes("renderDeviceGrid('virtual',virtualGrid,virtualFilter,virtualRoomFilter)")) fail("Virtual Devices page is not wired to the common renderer");
if (!virtualFrontend.includes("api('/api/adapters/virtual/devices'")) fail("Virtual device creation API is not wired in the frontend");
if (!virtualFrontend.includes("deviceShellyWebButton")) fail("Shelly device web shortcut is missing from the frontend");
if (!virtualFrontend.includes("window.open(url,'_blank','noopener,noreferrer')")) fail("Shelly web shortcut must open in an isolated new tab");
if (!virtualFrontend.includes('title="Shelly-Weboberfläche öffnen"')) fail("Shelly web shortcut title is missing");
if (!serverSource.includes('"/api/adapters/virtual/devices"')) fail("Virtual device creation API route is missing");
const automationFrontend = read("public/automation-ui.js");
const automationEngineSource = read("src/automations.ts");
const mainSource = read("src/main.ts");
if (!publicIndex.includes('data-nav="automations"')) fail("Automations navigation is missing");
if (!publicIndex.includes('data-page="automations"')) fail("Automations page is missing");
if (!automationFrontend.includes("turnOn:'An',turnOff:'Aus',toggle:'Toggle'")) fail("Automation action choices are incomplete");
if (!automationFrontend.includes("conditionDeviceId")) fail("Automation condition UI is missing");
if (!publicIndex.includes('id="automationTriggerDeviceSearch"') || !publicIndex.includes('id="automationConditionDeviceSearch"') || !publicIndex.includes('id="automationActionDeviceSearch"')) fail("Automation searchable device selectors are incomplete");
if (!automationFrontend.includes("automationDeviceMatchesSearch") || !automationFrontend.includes("automationDeviceSearchText")) fail("Automation device search implementation is missing");
if (!publicIndex.includes('id="automationRoom"')) fail("Automation room selector is missing");
if (!automationFrontend.includes("roomId:automationElements.room?.value||null")) fail("Automation room assignment is not included in the frontend payload");
if (!automationFrontend.includes("automationLastEventLabel") || !automationFrontend.includes("days===0?'Heute':days===1?'Gestern'")) fail("Automation relative last-event display is missing");
const databaseSource = read("src/db.ts");
const phosconAdapterSource = read("src/phoscon-adapter.ts");
const phosconCoreSource = read("src/phoscon-core.ts");
if (/ALTER\s+TABLE/i.test(databaseSource)) fail("canonical database schema must not contain incremental ALTER TABLE migrations");
if (!databaseSource.includes("CREATE TABLE IF NOT EXISTS automation_preferences")) fail("Automation room preference table is missing");
if (!databaseSource.includes("automation_id uuid PRIMARY KEY REFERENCES automations(id) ON DELETE CASCADE")) fail("Automation room preference ownership is missing");
if (!databaseSource.includes("room_id uuid REFERENCES rooms(id) ON DELETE SET NULL")) fail("Automation room preference foreign key is missing");
if (!databaseSource.includes("LEFT JOIN automation_preferences p ON p.automation_id=a.id")) fail("Automation room preferences are not joined when reading rules");
if (!databaseSource.includes("INSERT INTO automation_preferences(automation_id,room_id)")) fail("Automation room preference upsert is missing");
if (!databaseSource.includes("CREATE TABLE IF NOT EXISTS automation_triggers")) fail("Automation OR-trigger table is missing");
if (!databaseSource.includes("position smallint NOT NULL CHECK(position BETWEEN 1 AND 7)")) fail("Automation OR-trigger limit is missing from the canonical schema");
if (!databaseSource.includes("trigger_device_id text NOT NULL REFERENCES devices(id) ON DELETE CASCADE")) fail("Automation OR-trigger device reference is missing");
if (!databaseSource.includes('as "additionalTriggers"')) fail("Automation OR triggers are not loaded with rules");
if (!publicIndex.includes('id="automationAdditionalTriggers"') || !publicIndex.includes('id="automationAddTriggerButton"')) fail("Compact OR-trigger editor controls are missing");
if (!automationFrontend.includes("automationAdditionalTriggerPayload()") || !automationFrontend.includes("additionalTriggers:")) fail("Automation OR triggers are not included in the frontend payload");
if (!automationFrontend.includes("automationAdditionalTriggerPayload") || !automationFrontend.includes("renderAutomationAdditionalTriggers")) fail("Automation OR-trigger UI implementation is incomplete");
if (!phosconAdapterSource.includes("buttonFallbackIntervalMs = 2_000") || !phosconAdapterSource.includes("pollButtonSensors")) fail("Phoscon button fallback polling is missing");
if (!phosconAdapterSource.includes("buttonEventLastUpdated") || !phosconAdapterSource.includes('transport: "websocket" | "poll"')) fail("Phoscon button-event revision tracking is missing");
if (!automationFrontend.includes("automationPrimaryEventValues") || !automationFrontend.includes("sameDeviceEventTriggers")) fail("Automation multi-event selection is missing");
if (!automationFrontend.includes("automationToggleAdditionalEvent") || !automationFrontend.includes("renderAutomationAdditionalEventPicker")) fail("Additional OR-trigger multi-event selection is missing");
if (!automationFrontend.includes("automationStoredAdditionalTriggers") || !automationFrontend.includes("automationAdditionalTriggers.flatMap")) fail("Additional button-event groups are not merged and expanded through the existing OR-trigger payload");
if (!automationFrontend.includes('id="automationExtraEventPicker-${trigger.id}"')) fail("Additional OR-trigger event picker markup is missing");
if (!publicIndex.includes('id="automationTriggerEventPicker"') || !publicIndex.includes('id="automationTriggerEventOptions"')) fail("Automation multi-event picker markup is missing");
if (!automationEngineSource.includes("automationRuleTriggers") || !automationEngineSource.includes("AUTOMATION_TRIGGER_LIMIT")) fail("Automation engine does not validate multiple OR triggers");
if (!serverSource.includes("additionalTriggers: z.array(automationAdditionalTriggerSchema).max(7).default([])")) fail("Automation API does not accept bounded additional OR triggers");

if (!automationFrontend.includes("automationButtonEventMarker='event:buttonEvent'")) fail("Automation button-event trigger UI is missing");
if (!automationFrontend.includes("event:buttonEvent:${eventValue}")) fail("Automation button events are not persisted through the existing trigger key");
if (!serverSource.includes('"/api/automations"')) fail("Automation API routes are missing");
if (!automationEngineSource.includes('source: "automation"')) fail("Automation commands do not use the shared automation source");
if (!automationEngineSource.includes('AUTOMATION_CYCLE_NOT_ALLOWED')) fail("Automation loop protection is missing");
if (!automationEngineSource.includes('this.registry.on("deviceEvent", this.onDeviceEvent)')) fail("Automation engine does not subscribe to device events");
if (!automationEngineSource.includes("parseAutomationEventTrigger")) fail("Automation event trigger parser is missing");
if (!mainSource.includes("await automations.start()")) fail("Automation engine is not started during SALTA startup");
if (!mainSource.includes("automations.stop()")) fail("Automation engine is not stopped during SALTA shutdown");
if (!phosconAdapterSource.includes("new WebSocket(target)")) fail("Phoscon realtime websocket client is missing");
if (!phosconAdapterSource.includes("emitDeviceEvent")) fail("Phoscon button events are not forwarded to the SALTA event bus");
if (!phosconAdapterSource.includes("scheduleReconnect")) fail("Phoscon websocket reconnect handling is missing");
if (!phosconCoreSource.includes('profile !== "Daylight"')) fail("Phoscon Daylight sensor import is missing");
if (!phosconCoreSource.includes('normalized === "daylight"')) fail("Phoscon Daylight sensor is not classified as a light sensor");
if (!phosconCoreSource.includes('"sunrise", "sunset"') || !phosconCoreSource.includes('"daylightStatus"')) fail("Phoscon Daylight state mapping is incomplete");
if (!phosconAdapterSource.includes('current.profile?.split(" + ").includes("Daylight")') || !phosconAdapterSource.includes("statePatch.daylightStatus = daylightStatus")) fail("Phoscon Daylight realtime status updates are missing");
if (!virtualFrontend.includes("sunrise:'Sonnenaufgang'") || !virtualFrontend.includes("sunset:'Sonnenuntergang'") || !virtualFrontend.includes("daylightStatus:'Sonnenphase'")) fail("Phoscon Daylight frontend labels are missing");
if (!virtualFrontend.includes("split(' + ').includes('Daylight')?5:4")) fail("Phoscon Daylight card does not expose all five Daylight values");
const presenceSource = read("src/fritzbox-presence.ts");
const presenceFrontendTest = read("src/frontend-presence.test.ts");
if (!publicIndex.includes('data-nav="presence"') || !publicIndex.includes('data-page="presence"')) fail("Dedicated Presence navigation/page is missing");
for (const id of ["presenceSettingsForm", "presenceHouseSummary", "presenceTargetList", "presenceTargetForm", "presenceProtocol", "presenceHost", "presencePort", "presenceTlsInsecure"]) {
  if (!publicIndex.includes(`id="${id}"`)) fail(`Presence page section is missing: ${id}`);
}
if (!databaseSource.includes("CREATE TABLE IF NOT EXISTS fritzbox_presence_settings") || !databaseSource.includes("CREATE TABLE IF NOT EXISTS presence_targets") || !databaseSource.includes("CREATE TABLE IF NOT EXISTS fritzbox_presence_transport_settings")) fail("Presence persistence tables are missing");
if (!databaseSource.includes("tls_insecure boolean NOT NULL DEFAULT false")) fail("FRITZ!Box TLS verification setting persistence is missing");
if (!presenceSource.includes('urn:dslforum-org:service:Hosts:1') || !presenceSource.includes('GetSpecificHostEntry') || !presenceSource.includes('/upnp/control/hosts')) fail("FRITZ!Box TR-064 Hosts integration is incomplete");
if (!presenceSource.includes("missingSince") || !presenceSource.includes("absenceDelaySeconds")) fail("Presence absence hysteresis is missing");
if (!presenceSource.includes("rejectUnauthorized:!tlsInsecure") || presenceSource.includes("NODE_TLS_REJECT_UNAUTHORIZED")) fail("FRITZ!Box TLS certificate bypass must be request-scoped");
if (!serverSource.includes("FRITZBOX_TLS_CERTIFICATE") || !serverSource.includes("tlsInsecure")) fail("FRITZ!Box TLS certificate handling is incomplete");
if (!publicIndex.includes('<option value="http">HTTP</option>') || !publicIndex.includes('<option value="https">HTTPS</option>') || !publicIndex.includes('<option value="49000">49000</option>') || !publicIndex.includes('<option value="49443">49443</option>')) fail("FRITZ!Box protocol/port selectors are incomplete");
if (!publicIndex.includes('class="presence-connection-status-row"') || !publicIndex.includes('class="presence-endpoint-group"') || !publicIndex.includes('class="presence-transport-options"')) fail("FRITZ!Box presence connection layout is not the compact v0.8.15 layout");
if (!presenceSource.includes("lastTestSuccess") || !presenceSource.includes("lastTestHostCount") || !presenceSource.includes("lastTestBaseUrl")) fail("FRITZ!Box manual connection test status is not retained by the adapter");
if (!virtualFrontend.includes("Verbindung noch nicht geprüft") || !virtualFrontend.includes("FRITZ!Box erreichbar") || !virtualFrontend.includes("loadPresence({applySettings:false})")) fail("FRITZ!Box connection test result is not rendered independently of presence activation");
if (!virtualFrontend.includes("presenceSettingsDirty=false") || !virtualFrontend.includes("if(applySettings&&!presenceSettingsDirty)applyPresenceSettingsToForm()") || !virtualFrontend.includes("presenceSettingsForm.addEventListener('input',()=>{presenceSettingsDirty=true})")) fail("Presence settings refresh can overwrite unsaved credentials");
if (!presenceSource.includes('name:"Hauspräsenz"') || !presenceSource.includes("nobodyHome") || !presenceSource.includes("presentCount")) fail("House presence aggregation is missing");
for (const route of ['/api/presence', '/api/presence/settings', '/api/presence/test', '/api/presence/devices', '/api/presence/refresh']) {
  if (!serverSource.includes(route)) fail(`Presence API route is missing: ${route}`);
}
if (!mainSource.includes("new FritzBoxPresenceAdapter(registry)") || !mainSource.includes("presence.start()") || !mainSource.includes("presence.stop()")) fail("Presence adapter lifecycle is incomplete");
if (!automationFrontend.includes("'present','anyHome','nobodyHome'") || !automationFrontend.includes("present:['Anwesend','Abwesend']") || !automationFrontend.includes("anyHome:['Jemand zuhause','Niemand zuhause']")) fail("Presence automation states are missing");
if (!presenceFrontendTest.includes('data-nav="presence"') || !presenceFrontendTest.includes('id="presenceSettingsForm"') || !presenceFrontendTest.includes("'nobodyHome'")) fail("Presence frontend regression coverage is incomplete");
if (!phosconCoreSource.includes("websocketport")) fail("Phoscon websocket port discovery is missing");
if (!phosconCoreSource.includes('sensor.type === "button"')) fail("Phoscon button resources may be merged into actuator devices");
const automationPersistenceSource = read("src/automation-persistence.ts");
if (automationEngineSource.includes('from "./db.js"')) fail("automation core must not import the database/configuration layer directly");
if (!automationPersistenceSource.includes('from "./db.js"')) fail("automation persistence adapter is not wired to the database layer");
if (!mainSource.includes("databaseAutomationStore, databaseAutomationLogger")) fail("main does not inject automation persistence and logging adapters");
const frontendAutomationTestSource = read("src/frontend-automations.test.ts");
const phosconWebSocketTestSource = read("src/phoscon-websocket.test.ts");
if (frontendAutomationTestSource.includes('expect(ui).toContain("Mehrere Ereignisse werden ODER-verknüpft")')) fail("Automation multi-event hint test must inspect the HTML owner, not automation-ui.js");
if (frontendAutomationTestSource.includes('additionalTriggers:automationAdditionalTriggerPayload()')) fail("Automation OR-trigger test still assumes the pre-multi-event payload shape");
if (phosconWebSocketTestSource.includes('typeof statePatch.buttonEvent === "number"')) fail("Phoscon websocket test still assumes the pre-normalization button event type check");
const testRunnerSource = read("scripts/check-test-symbols.mjs");
if (!testRunnerSource.includes('resolve(root, "node_modules", "vitest", "vitest.mjs")')) fail("npm test does not launch the locked local Vitest executable");
if (!testRunnerSource.includes('NODE_ENV: "test"')) fail("test runner does not force NODE_ENV=test");
for (const variable of ["DATABASE_URL", "ADMIN_PASSWORD", "SALTA_HEALTH_TOKEN", "SALTA_ENCRYPTION_KEY"]) {
  if (!testRunnerSource.includes(`${variable}: process.env.${variable} ??`)) fail(`test runner does not initialize ${variable}`);
}
if (testRunnerSource.includes("vitest.config.ts") || testRunnerSource.includes("test-setup.ts")) fail("test runner must not depend on optional standalone Vitest bootstrap files");
const homeKitSource = read("src/homekit.ts");
if (!homeKitSource.includes("this.commander.command({deviceId:d.id")) fail("HomeKit does not use the shared device command dispatcher");

const packageJson = json("package.json");
const packageLock = json("package-lock.json");
if (!String(packageJson.scripts?.check ?? "").includes("node --check public/automation-ui.js")) fail("npm run check must syntax-check automation-ui.js");
if (packageJson.scripts?.["test:preflight"] !== "node scripts/check-test-symbols.mjs") fail("test:preflight script is missing or changed");
if (packageJson.scripts?.test !== "node scripts/check-test-symbols.mjs --vitest") fail("npm test must use the preflight-backed Vitest runner");
if (!String(packageJson.scripts?.check ?? "").includes("npm test")) fail("npm run check must execute the preflight-backed test runner");
const testTypeConfig = json("tsconfig.tests.json");
if (!Array.isArray(testTypeConfig.exclude) || testTypeConfig.exclude.length !== 0) fail("tsconfig.tests.json must include test files instead of inheriting the production test exclusion");
const productionTypeConfig = json("tsconfig.json");
const testSymbolPreflight = read("scripts/check-test-symbols.mjs");
if (!testSymbolPreflight.includes("diagnostic.code === 2304 || diagnostic.code === 2552")) fail("test symbol preflight must reject unresolved TypeScript identifiers");
const version = String(packageJson.version ?? "");

if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`invalid package version ${version}`);
if (packageLock.version !== version) fail("package-lock.json top-level version differs from package.json");
if (packageLock.packages?.[""]?.version !== version) fail("package-lock.json root package version differs from package.json");

const gitRefName = process.env.GITHUB_REF_NAME;
if (gitRefName?.startsWith("v") && gitRefName !== `v${version}`) {
  fail(`Git tag ${gitRefName} does not match package version v${version}`);
}

const versionSurfaces = [
  [".env.example", `SALTA_IMAGE=ghcr.io/syschelle/salta:${version}`],
  ["docker-compose.image.yml", `ghcr.io/syschelle/salta:${version}`],
  ["install.sh", `SALTA v${version} is starting.`],
  ["public/index.html", `Version <strong>${version}</strong>`],
  ["src/server.ts", `version: "${version}"`],
  ["src/deployment-config.test.ts", `ghcr.io/syschelle/salta:${version}`],
  ["src/server.test.ts", `version: "${version}"`],
  ["RELEASE_TEXT.md", `# SALTA v${version}`],
  ["GIT_COMMANDS.md", `# SALTA v${version}`],
  ["docs-ghcr.md", `v${version}`],
];

for (const [file, expected] of versionSurfaces) {
  if (!read(file).includes(expected)) fail(`${file} does not contain the current version marker: ${expected}`);
}

for (const [path, entry] of Object.entries(packageLock.packages ?? {})) {
  const resolved = entry?.resolved;
  if (typeof resolved !== "string") continue;
  let url;
  try {
    url = new URL(resolved);
  } catch {
    fail(`${path || "root"} has an invalid resolved URL`);
  }
  if (url.protocol !== "https:" || url.hostname !== "registry.npmjs.org") {
    fail(`${path || "root"} uses a non-public npm registry URL: ${resolved}`);
  }
}

const exactOverrides = {
  "find-my-way": "9.7.0",
  "@homebridge/dbus-native": "0.7.7",
};

for (const [dependency, expectedVersion] of Object.entries(exactOverrides)) {
  if (packageJson.overrides?.[dependency] !== expectedVersion) {
    fail(`package.json must override ${dependency} to ${expectedVersion}`);
  }
  const suffix = `/node_modules/${dependency}`;
  const entries = Object.entries(packageLock.packages ?? {}).filter(
    ([path]) => path === `node_modules/${dependency}` || path.endsWith(suffix),
  );
  if (!entries.length) fail(`${dependency} is missing from package-lock.json`);
  for (const [path, entry] of entries) {
    if (entry?.version !== expectedVersion) fail(`${path} resolves to ${entry?.version}, expected ${expectedVersion}`);
  }
}

const dbus = packageLock.packages?.["node_modules/@homebridge/dbus-native"];
if (dbus?.resolved !== "https://registry.npmjs.org/@homebridge/dbus-native/-/dbus-native-0.7.7.tgz") {
  fail("@homebridge/dbus-native tarball URL is inconsistent");
}
if (dbus?.integrity !== "sha512-VwTSCy1qofS0QLHtOiSVVmtR49xr/DR17D+5VeJm+xw1rGaluv++MF/atF1Jomxsf4WduVed63ouX2s6SH17Qw==") {
  fail("@homebridge/dbus-native integrity checksum is inconsistent");
}

const testFiles = readdirSync(resolve(root, "src"), { recursive: true })
  .filter((file) => typeof file === "string" && file.endsWith(".test.ts"));
const forbiddenExactCallAssertions = [
  "targetTemperatureControl(d)",
  "thermostatModeControl(d)",
  "brightnessControl(d)",
  "coverControl(d)",
];
for (const file of testFiles) {
  const source = read(`src/${file}`);
  for (const exactCall of forbiddenExactCallAssertions) {
    if (source.includes(`toContain(\"${exactCall}\")`) || source.includes(`toContain('${exactCall}')`)) {
      fail(`${file} contains the fragile exact-call assertion ${exactCall}; use the AST source-inspection helper instead`);
    }
  }
  if (/toContain\(\s*[\"'`]@media[^\"'`]*\{\./.test(source)) {
    fail(`${file} contains a fragile media-query selector-adjacency assertion; use cssMediaRuleContains instead`);
  }
}

const densityTest = read("src/frontend-device-density.test.ts");
if (densityTest.includes("latestRule(")) {
  fail("frontend-device-density.test.ts must inspect all matching CSS rules instead of only the last media-query override");
}
if (!densityTest.includes("cssRuleContains")) {
  fail("frontend-device-density.test.ts must use the shared CSS rule inspection helper");
}

const automationFrontendTest = read("src/frontend-automations.test.ts");
if (automationFrontendTest.includes("@media(max-width:620px){.automation-card")) {
  fail("frontend-automations.test.ts must not require selector adjacency inside a media query");
}
if (!automationFrontendTest.includes("cssMediaRuleContains")) {
  fail("frontend-automations.test.ts must use the shared media-query CSS inspection helper");
}
const styleInspectionHelper = read("src/test-utils/style-inspection.ts");
if (!styleInspectionHelper.includes("cssMediaRuleContains") || !styleInspectionHelper.includes("cssMediaBlocks")) {
  fail("style-inspection.ts must provide media-query-aware CSS inspection helpers");
}

const openCcuControlTest = read("src/openccu-control.test.ts");
if (!openCcuControlTest.includes("functionTransitivelyCalls")) {
  fail("openccu-control.test.ts must follow the renderer call graph through composed control helpers");
}

console.log(`Release validation passed for SALTA v${version}.`);
