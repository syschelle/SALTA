import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const fail = (message) => {
  throw new Error(`Release validation failed: ${message}`);
};

const requiredReleaseFiles = [
  "docker-compose.image.yml",
  ".env.example",
  "scripts/check-test-symbols.mjs",
  "src/automations.ts",
  "src/automation-persistence.ts",
  "src/phoscon-adapter.ts",
  "src/phoscon-core.ts",
  "src/fritzbox-presence.ts",
  "src/climate-mode.ts",
  "src/battery-monitor.ts",
  "src/configuration-backup.ts",
  "src/disaster-recovery-backup.ts",
  "src/runtime-settings.ts",
  "migrate-homekit-storage.sh",
  "test-utils/source-inspection.ts",
  "test-utils/style-inspection.ts",
  "public/automation-ui.js",
];
for (const file of requiredReleaseFiles) {
  if (!existsSync(resolve(root, file))) fail(`required release file is missing: ${file}`);
}

const optionalDeploymentScripts = ["install.sh", "update.sh", "backup.sh", "restore.sh"];
for (const file of optionalDeploymentScripts) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  const source = read(file);
  if (!source.startsWith("#!/usr/bin/env sh")) fail(`optional deployment helper must use the portable sh shebang: ${file}`);
  if (!source.includes("-f docker-compose.image.yml")) fail(`optional deployment helper must use docker-compose.image.yml: ${file}`);
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
if (!publicIndex.includes('id="deviceInfoGrid"') || !publicIndex.includes('id="deviceDialogMeta"') || !publicIndex.includes('class="workflow-dialog device-config-dialog"')) fail("Structured device configuration dialog is incomplete");
if (!virtualFrontend.includes("function renderDeviceDialogInfo(d)") || !virtualFrontend.includes("function renumberDeviceConfigSections()")) fail("Device information rendering or visible-section numbering is missing");
if (!virtualFrontend.includes("Zuletzt gesehen: ${escapeHtml(deviceInfoTimestamp(selectedDevice.lastSeen))}")) fail("Shelly device dialog does not expose last-seen metadata in the header");
if (!virtualFrontend.includes("add('Zuletzt gesehen',deviceInfoTimestamp(d.lastSeen))")) fail("Device information grid does not expose last-seen metadata");
const shellyAdapterSource = read("src/shelly-adapter.ts");
if (shellyAdapterSource.includes("reachable: false, lastSeen: now()")) fail("Failed Shelly refreshes must not advance lastSeen");
if (!shellyAdapterSource.includes("const next = { ...device, reachable: false };")) fail("Shelly offline refresh path does not preserve the previous lastSeen timestamp");
if (!virtualFrontend.includes("add('Sensor-Ressourcen',adapter.sensorResourceIds,{copy:true})") || !virtualFrontend.includes("add('OpenCCU-Kanalname',adapter.channelName)")) fail("Source-specific device information is incomplete");
if (!serverSource.includes('"/api/adapters/virtual/devices"')) fail("Virtual device creation API route is missing");
const climateModeSource = read("src/climate-mode.ts");
const batteryMonitorSource = read("src/battery-monitor.ts");
const climateDbSource = read("src/db.ts");
if (!publicIndex.includes('id="climateSummerButton"') || !publicIndex.includes('id="climateWinterButton"') || !publicIndex.includes('id="climateWinterModeDisplay"')) fail("Global summer/winter thermostat controls are missing");
if (!publicIndex.includes('data-settings-panel="climate"') || !publicIndex.includes('id="climateSettingsWinterMode"') || !publicIndex.includes('id="climateApplyNowButton"')) fail("Climate mode settings are missing");
if (!publicIndex.includes('class="panel overview-system-card climate-mode-card" data-homekit-exposed="false"')) fail("Climate mode must remain explicitly SALTA-only");
if (!serverSource.includes('"/api/system/climate-mode"') || !serverSource.includes('"/api/settings/climate-mode"')) fail("Climate mode APIs are missing");
if (!climateModeSource.includes('value: targetMode') || !climateModeSource.includes('source: "system"')) fail("Climate mode does not route thermostat mode commands through SALTA system commands");
if (!climateModeSource.includes('async setWinterMode') || !climateModeSource.includes('updateClimateWinterMode')) fail("Winter thermostat mode is not stored separately from mode application");
if (!batteryMonitorSource.includes("7 * 24 * 60 * 60 * 1000")) fail("Battery warning does not enforce the seven-day notification interval");
if (!batteryMonitorSource.includes("https://api.pushover.net/1/messages.json")) fail("Pushover message endpoint is missing");
if (!publicIndex.includes('data-settings-panel="notifications"') || !publicIndex.includes('id="notificationBatteryThreshold"')) fail("Pushover battery warning settings are missing");
if (!climateDbSource.includes("CREATE TABLE IF NOT EXISTS climate_mode_settings") || !climateDbSource.includes("CREATE TABLE IF NOT EXISTS notification_settings") || !climateDbSource.includes("CREATE TABLE IF NOT EXISTS notification_state")) fail("Climate and notification persistence tables are missing");
if (!climateDbSource.includes("encrypted_user_key") || !climateDbSource.includes("encrypted_api_token")) fail("Pushover credentials are not stored in encrypted fields");
const configurationBackupSource = read("src/configuration-backup.ts");
const disasterRecoverySource = read("src/disaster-recovery-backup.ts");
const runtimeSettingsSource = read("src/runtime-settings.ts");
const homeKitRecoverySource = read("src/homekit.ts");
const configSource = read("src/config.ts");
const productionCompose = read("docker-compose.image.yml");
if (!publicIndex.includes('data-settings-panel="backup"') || !publicIndex.includes('id="recoveryBackupExportPassword"') || !publicIndex.includes('id="recoveryBackupImportPassword"') || !publicIndex.includes('id="recoveryBackupImportButton"')) fail("Disaster-recovery settings UI is missing");
if (!serverSource.includes('"/api/settings/disaster-recovery-backup"') || !serverSource.includes('"/api/settings/disaster-recovery-backup/import"')) fail("Disaster-recovery API routes are missing");
if (!disasterRecoverySource.includes('DISASTER_RECOVERY_BACKUP_FORMAT = "salta-disaster-recovery-backup"') || !disasterRecoverySource.includes('createCipheriv("aes-256-gcm"') || !disasterRecoverySource.includes('scryptSync(')) fail("Password-encrypted disaster-recovery format is incomplete");
if (!disasterRecoverySource.includes('currentRestorableRuntimeSettings') || !disasterRecoverySource.includes('writePersistedRuntimeSettings') || !disasterRecoverySource.includes('homeKit: { files: homeKitFiles }')) fail("Disaster recovery does not include runtime identity and HomeKit state");
if (!runtimeSettingsSource.includes('"SALTA_ENCRYPTION_KEY"') || !runtimeSettingsSource.includes('"ADMIN_PASSWORD"') || !runtimeSettingsSource.includes('"HOMEKIT_USERNAME"')) fail("Runtime recovery settings omit required SALTA identity secrets");
if (!configSource.includes('loadPersistedRuntimeSettings()') || !configSource.includes('{ ...process.env, ...persistedRuntimeSettings }')) fail("Restored runtime settings do not override bootstrap environment values");
if (!homeKitRecoverySource.includes('HAPStorage.setCustomStoragePath(config.HOMEKIT_STORAGE_PATH)')) fail("HomeKit storage is not pinned to persistent SALTA storage");
if (!productionCompose.includes('name: salta_runtime_data') || !productionCompose.includes('salta_runtime_data:/var/lib/salta') || !productionCompose.includes('HOMEKIT_STORAGE_PATH: /var/lib/salta/homekit') || !productionCompose.includes('SALTA_RUNTIME_SETTINGS_PATH: /var/lib/salta/runtime/settings.json')) fail("Production Compose does not persist disaster-recovery/HomeKit runtime state");
const homeKitMigrationSource = read("migrate-homekit-storage.sh");
if (!homeKitMigrationSource.includes('LEGACY_PATH="/app/persist"') || !homeKitMigrationSource.includes('salta_runtime_data')) fail("Legacy HomeKit pairing migration helper is incomplete");
if (!configurationBackupSource.includes('notification_state: "SELECT * FROM notification_state ORDER BY key"') || !configurationBackupSource.includes('notification_state: "INSERT INTO notification_state SELECT * FROM jsonb_populate_recordset')) fail("Disaster recovery must preserve notification cooldown state");
if (configurationBackupSource.includes('decryptSecret(') || configurationBackupSource.includes('getGlobalShellyCredentials(') || configurationBackupSource.includes('getOpenCcuConnection(')) fail("Configuration snapshot export must not decrypt stored integration credentials");


const automationFrontend = read("public/automation-ui.js");
const publicStyles = read("public/styles.css");
if (!publicStyles.includes("--layout-page-max:1680px") || !publicStyles.includes("--layout-side-md:380px") || !publicStyles.includes("--dialog-device-width:860px")) fail("Shared layout width tokens are missing");
if (!publicStyles.includes(".device-config-dialog{width:min(var(--dialog-device-width),calc(100vw - 28px))}")) fail("Device configuration dialog does not use the consolidated width token");
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
if (!automationFrontend.includes("function automationTriggerSummaryItems(rule)") || !automationFrontend.includes("...(rule.additionalTriggers||[])")) fail("Automation rule summaries do not include all OR-trigger devices");
if (!automationFrontend.includes("automationTriggerSummaryMarkup(summary.triggerItems)") || !automationFrontend.includes('class="automation-trigger-list"')) fail("Automation rule summaries do not render the complete compact trigger list");
if (automationFrontend.includes("Ohne zusätzliche Bedingung")) fail("Automation cards still render the redundant empty-condition row");
if (!publicStyles.includes(".automation-card-icon-action") || !publicStyles.includes(".automation-trigger-chip") || !publicStyles.includes(".automation-list{display:grid;gap:8px}")) fail("Compact automation-card presentation is missing");
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
const securitySource = read("SECURITY.md");
if (!publicIndex.includes('data-nav="presence"') || !publicIndex.includes('data-page="presence"')) fail("Dedicated Presence navigation/page is missing");
for (const id of ["presenceSettingsForm", "presenceHouseSummary", "presenceTargetList", "presenceTargetForm", "presenceProtocol", "presenceHost", "presencePort", "presenceTlsInsecure"]) {
  if (!publicIndex.includes(`id="${id}"`)) fail(`Presence page section is missing: ${id}`);
}
if (!databaseSource.includes("CREATE TABLE IF NOT EXISTS fritzbox_presence_settings") || !databaseSource.includes("CREATE TABLE IF NOT EXISTS presence_targets") || !databaseSource.includes("CREATE TABLE IF NOT EXISTS fritzbox_presence_transport_settings")) fail("Presence persistence tables are missing");
if (!databaseSource.includes("tls_insecure boolean NOT NULL DEFAULT false")) fail("FRITZ!Box TLS verification setting persistence is missing");
if (!presenceSource.includes('urn:dslforum-org:service:Hosts:1') || !presenceSource.includes('GetSpecificHostEntry') || !presenceSource.includes('/upnp/control/hosts')) fail("FRITZ!Box TR-064 Hosts integration is incomplete");
if (!presenceSource.includes('tr64desc.xml') || !presenceSource.includes('hostsControlUrlFromDescription') || !presenceSource.includes('controlURL')) fail("FRITZ!Box Hosts controlURL discovery from tr64desc.xml is missing");
if (!presenceSource.includes('Always try the plain request first') || !presenceSource.includes('let response = await execute(normalBody)')) fail("FRITZ!Box rights-free Hosts requests must be attempted before authentication negotiation");
if (!presenceSource.includes('errorCode:code')) fail("Presence system-log details do not expose the safe FRITZ!Box error code");
if (!presenceSource.includes("missingSince") || !presenceSource.includes("absenceDelaySeconds")) fail("Presence absence hysteresis is missing");
if (!presenceSource.includes("rejectUnauthorized:!tlsInsecure") || presenceSource.includes("NODE_TLS_REJECT_UNAUTHORIZED")) fail("FRITZ!Box TLS certificate bypass must be request-scoped");
if (!presenceSource.includes("InitChallenge") || !presenceSource.includes("ClientAuth") || !presenceSource.includes("F!Box SOAP-Auth") && !presenceSource.includes("contentAuthDigest")) fail("FRITZ!Box SOAP content-level authentication is missing");
const directMd5Calls = presenceSource.match(/createHash\(["']md5["']\)/g) ?? [];
if (directMd5Calls.length !== 2) fail(`FRITZ!Box Presence must contain exactly two protocol-mandated direct MD5 calls, found ${directMd5Calls.length}`);
const presenceLines = presenceSource.split(/\r?\n/);
const md5LineIndexes = presenceLines.map((line,index)=>line.includes('createHash("md5")')?index:-1).filter(index=>index>=0);
if (md5LineIndexes.length !== 2) fail("FRITZ!Box protocol MD5 line detection is inconsistent");
const firstMd5Suppression = presenceLines[md5LineIndexes[0]-1] ?? "";
const secondMd5Suppression = presenceLines[md5LineIndexes[1]-1] ?? "";
if (!firstMd5Suppression.includes("codeql[js/insufficient-password-hash]") || !firstMd5Suppression.includes("lgtm[js/weak-cryptographic-algorithm]")) fail("FRITZ!Box first protocol MD5 line is missing its two query-specific CodeQL suppressions");
if (!secondMd5Suppression.includes("codeql[js/weak-cryptographic-algorithm]")) fail("FRITZ!Box second protocol MD5 line is missing its weak-crypto CodeQL suppression");
if ((presenceSource.match(/codeql\[js\/insufficient-password-hash\]/g) ?? []).length !== 1 || (presenceSource.match(/lgtm\[js\/weak-cryptographic-algorithm\]/g) ?? []).length !== 1 || (presenceSource.match(/codeql\[js\/weak-cryptographic-algorithm\]/g) ?? []).length !== 1) fail("FRITZ!Box protocol MD5 suppression scope is broader than expected");
if (!presenceSource.includes("protocol interoperability, not") || !presenceSource.includes("ClientAuth incompatible with FRITZ!OS")) fail("FRITZ!Box protocol-mandated MD5 rationale is missing");
if (!securitySource.includes("Protocol-mandated MD5 in FRITZ!Box authentication") || !securitySource.includes("not used to store SALTA passwords")) fail("SECURITY.md does not document the scoped FRITZ!Box protocol MD5 exception");
if (!presenceSource.includes("parseDigestChallenge") || !presenceSource.includes("digestAuthHeader")) fail("FRITZ!Box HTTP Digest compatibility fallback is missing");
if (!serverSource.includes("FRITZBOX_AUTHENTICATION_REQUIRED") || !serverSource.includes("FRITZBOX_AUTHORIZATION_FAILED")) fail("FRITZ!Box authentication/authorization error mapping is incomplete");
if (!serverSource.includes("FRITZBOX_TLS_CERTIFICATE") || !serverSource.includes("tlsInsecure")) fail("FRITZ!Box TLS certificate handling is incomplete");
if (!publicIndex.includes('<option value="http">HTTP</option>') || !publicIndex.includes('<option value="https">HTTPS</option>') || !publicIndex.includes('<option value="49000">49000</option>') || !publicIndex.includes('<option value="49443">49443</option>')) fail("FRITZ!Box protocol/port selectors are incomplete");
if (!publicIndex.includes('class="presence-connection-status-row"') || !publicIndex.includes('class="presence-endpoint-group"') || !publicIndex.includes('class="presence-transport-options"')) fail("FRITZ!Box presence connection layout is not the compact v0.8.15 layout");
if (!presenceSource.includes("lastTestSuccess") || !presenceSource.includes("lastTestHostCount") || !presenceSource.includes("lastTestBaseUrl")) fail("FRITZ!Box manual connection test status is not retained by the adapter");
if (!presenceSource.includes('"content-length": String(Buffer.byteLength(body,"utf8"))')) fail("FRITZ!Box SOAP requests do not set an explicit UTF-8 Content-Length");
if (!presenceSource.includes('"user-agent": "SALTA TR-064 Client"')) fail("FRITZ!Box SOAP requests are missing the SALTA TR-064 user agent");
if (!presenceSource.includes('"FRITZ!Box presence connection test failed"') || !presenceSource.includes('"FRITZ!Box presence synchronization failed"') || !presenceSource.includes('"FRITZ!Box presence device query failed"')) fail("Presence failures are not persisted to the system log");
if (!presenceSource.includes("lastConnectionErrorSignature") || !presenceSource.includes("targetErrorSignatures")) fail("Presence system-log error deduplication is missing");
if (!presenceSource.includes('"FRITZBOX_PRESENCE_RECOVERED"') || !presenceSource.includes('"FRITZBOX_PRESENCE_DEVICE_RECOVERED"')) fail("Presence recovery events are not persisted to the system log");
if (!virtualFrontend.includes("Verbindung noch nicht geprüft") || !virtualFrontend.includes("FRITZ!Box erreichbar") || !virtualFrontend.includes("loadPresence({applySettings:false})")) fail("FRITZ!Box connection test result is not rendered independently of presence activation");
if (!virtualFrontend.includes("presenceSettingsDirty=false") || !virtualFrontend.includes("if(applySettings&&!presenceSettingsDirty)applyPresenceSettingsToForm()") || !virtualFrontend.includes("presenceSettingsForm.addEventListener('input',()=>{presenceSettingsDirty=true})")) fail("Presence settings refresh can overwrite unsaved credentials");
if (!presenceSource.includes('name:"Hauspräsenz"') || !presenceSource.includes("nobodyHome") || !presenceSource.includes("presentCount")) fail("House presence aggregation is missing");
if (!publicIndex.includes('class="overview-header"') || !publicIndex.includes('class="stats overview-stats"') || !publicIndex.includes('id="overviewPresenceCard"')) fail("Compact overview summary with Presence is missing");
if (!virtualFrontend.includes("device.id==='presence:house'") || !virtualFrontend.includes("device.profile==='presence-group'") || !virtualFrontend.includes("presenceValue.textContent=anyHome?'Zuhause':'Niemand'")) fail("Overview house-presence summary is not wired to the existing presence-group device");
if (!publicStyles.includes('.overview-stats{grid-template-columns:repeat(5,minmax(0,1fr))') || !publicStyles.includes('.overview-heading h1{font-size:28px') || !publicStyles.includes('.overview-presence-stat.home')) fail("Compact overview header/stat styling is missing");
for (const route of ['/api/presence', '/api/presence/settings', '/api/presence/test', '/api/presence/devices', '/api/presence/refresh']) {
  if (!serverSource.includes(route)) fail(`Presence API route is missing: ${route}`);
}
if (!mainSource.includes("new FritzBoxPresenceAdapter(registry)") || !mainSource.includes("presence.start()") || !mainSource.includes("presence.stop()")) fail("Presence adapter lifecycle is incomplete");
if (!automationFrontend.includes("'present','anyHome','nobodyHome'") || !automationFrontend.includes("present:['Anwesend','Abwesend']") || !automationFrontend.includes("anyHome:['Jemand zuhause','Niemand zuhause']")) fail("Presence automation states are missing");
if (!phosconCoreSource.includes("websocketport")) fail("Phoscon websocket port discovery is missing");
if (!phosconCoreSource.includes('sensor.type === "button"')) fail("Phoscon button resources may be merged into actuator devices");
const automationPersistenceSource = read("src/automation-persistence.ts");
if (automationEngineSource.includes('from "./db.js"')) fail("automation core must not import the database/configuration layer directly");
if (!automationPersistenceSource.includes('from "./db.js"')) fail("automation persistence adapter is not wired to the database layer");
if (!mainSource.includes("databaseAutomationStore, databaseAutomationLogger")) fail("main does not inject automation persistence and logging adapters");
const testRunnerSource = read("scripts/check-test-symbols.mjs");
if (!testRunnerSource.includes('resolve(root, "node_modules", "vitest", "vitest.mjs")')) fail("npm test does not launch the locked local Vitest executable");
if (!testRunnerSource.includes('const vitestOnly = process.argv.includes("--vitest-only")')) fail("test runner does not support the optimized Vitest-only phase");
if (!testRunnerSource.includes('NODE_ENV: "test"')) fail("test runner does not force NODE_ENV=test");
for (const variable of ["DATABASE_URL", "ADMIN_PASSWORD", "SALTA_HEALTH_TOKEN", "SALTA_ENCRYPTION_KEY"]) {
  if (!testRunnerSource.includes(`${variable}: process.env.${variable} ??`)) fail(`test runner does not initialize ${variable}`);
}
if (testRunnerSource.includes("vitest.config.ts") || testRunnerSource.includes("test-setup.ts")) fail("test runner must not depend on optional standalone Vitest bootstrap files");
const homeKitSource = read("src/homekit.ts");
if (!homeKitSource.includes("this.commander.command({deviceId:d.id")) fail("HomeKit does not use the shared device command dispatcher");
if (!homeKitSource.includes("!isHomeKitSupportedDevice(d)") || !homeKitSource.includes("homeKitAccessoryName(d)")) fail("HomeKit bridge does not enforce supported-device publication and optional HomeKit names");
if (!databaseSource.includes("CREATE TABLE IF NOT EXISTS device_homekit_settings") || !databaseSource.includes("use_salta_room boolean NOT NULL DEFAULT true")) fail("Additive per-device HomeKit settings are missing");
if (!databaseSource.includes('COALESCE(hk.use_salta_room,true) as "homekitUseSaltaRoom"') || !databaseSource.includes('as "homekitRoom"')) fail("HomeKit SALTA-room inheritance is not exposed by the device query");
if (!publicIndex.includes('id="deviceHomeKitEnabled"') || !publicIndex.includes('id="deviceHomeKitUseSaltaRoom"') || !publicIndex.includes('id="deviceHomeKitRoom"')) fail("Device HomeKit configuration controls are incomplete");
if (!virtualFrontend.includes("function homeKitSupportedDevice(d)") || !virtualFrontend.includes("homekitUseSaltaRoom:useSaltaRoom") || !virtualFrontend.includes("homekitRoomId:useSaltaRoom?null:")) fail("Device HomeKit configuration is not wired to the API payload");

const packageJson = json("package.json");
const packageLock = json("package-lock.json");
const checkScript = String(packageJson.scripts?.check ?? "");
for (const command of [
  "npm run validate:release",
  "npm run test:preflight",
  "node --check public/room-grouping.js",
  "node --check public/automation-ui.js",
  "node --check public/app.js",
  "npm run build",
  "npm run test:vitest",
]) {
  if (!checkScript.includes(command)) fail(`npm run check is missing: ${command}`);
}
if (checkScript.includes("npm run typecheck")) fail("npm run check must not compile production TypeScript twice; npm run build already typechecks");
if (packageJson.scripts?.["test:preflight"] !== "node scripts/check-test-symbols.mjs") fail("test:preflight script is missing or changed");
if (packageJson.scripts?.["test:vitest"] !== "node scripts/check-test-symbols.mjs --vitest-only") fail("test:vitest script is missing or changed");
if (packageJson.scripts?.test !== "node scripts/check-test-symbols.mjs --vitest") fail("npm test must keep the standalone preflight-backed Vitest runner");
const testSymbolPreflight = read("scripts/check-test-symbols.mjs");
if (!testSymbolPreflight.includes('include: ["src/**/*.ts", "test-utils/**/*.ts"]') || !testSymbolPreflight.includes("exclude: []")) fail("test symbol preflight must derive a test-inclusive config from tsconfig.json");
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
if (existsSync(resolve(root, "install.sh")) && !read("install.sh").includes(`SALTA v${version} is starting.`)) {
  fail(`install.sh does not contain the current version marker: SALTA v${version} is starting.`);
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

const parseNumericVersion = (value) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value ?? ""));
  return match ? match.slice(1).map(Number) : null;
};
const versionAtLeast = (value, minimum) => {
  const actual = parseNumericVersion(value);
  const floor = parseNumericVersion(minimum);
  if (!actual || !floor) return false;
  for (let i = 0; i < 3; i += 1) {
    if (actual[i] > floor[i]) return true;
    if (actual[i] < floor[i]) return false;
  }
  return true;
};

for (const [path, entry] of Object.entries(packageLock.packages ?? {})) {
  if (!(path === "node_modules/fast-uri" || path.endsWith("/node_modules/fast-uri"))) continue;
  const major = parseNumericVersion(entry?.version)?.[0];
  const minimum = major === 2 ? "2.4.4" : major === 3 ? "3.1.5" : major === 4 ? "4.1.2" : null;
  if (minimum && !versionAtLeast(entry?.version, minimum)) {
    fail(`${path} resolves to vulnerable fast-uri ${entry?.version}; expected at least ${minimum}`);
  }
}
for (const [path, entry] of Object.entries(packageLock.packages ?? {})) {
  if (!(path === "node_modules/postcss" || path.endsWith("/node_modules/postcss"))) continue;
  const parsed = parseNumericVersion(entry?.version);
  if (parsed?.[0] === 8 && parsed?.[1] === 5 && !versionAtLeast(entry?.version, "8.5.23")) {
    fail(`${path} resolves to vulnerable postcss ${entry?.version}; expected at least 8.5.23`);
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
for (const file of testFiles) {
  const source = read(`src/${file}`);
  if (/expect\((?:source|script)\)\.toContain\(\s*["'`]const\s+\w+\s*=\s*\{/.test(source)) {
    fail(`${file} contains a fragile exact object-literal source assertion; inspect AST properties instead`);
  }
  if (/expect\((?:source|script)\)\.toContain\(\s*["'`](?:async\s+)?function\s+[A-Za-z_$]/.test(source)) {
    fail(`${file} contains a fragile exact function-declaration source assertion; use source-inspection.ts instead`);
  }
  if (/toContain\(\s*["'`]@media[^"'`]*\{\./.test(source)) {
    fail(`${file} contains a fragile media-query selector-adjacency assertion; use cssMediaRuleContains instead`);
  }
}

const sourceInspectionHelper = read("test-utils/source-inspection.ts");
for (const helper of ["parseJavaScriptSource", "hasFunction", "functionCalls", "functionCallsWithStringArgument", "objectLiteralPropertyNames"]) {
  if (!sourceInspectionHelper.includes(`function ${helper}`)) fail(`source-inspection.ts must provide ${helper}`);
}
const styleInspectionHelper = read("test-utils/style-inspection.ts");
if (!styleInspectionHelper.includes("cssMediaRuleContains") || !styleInspectionHelper.includes("cssMediaBlocks")) {
  fail("style-inspection.ts must provide media-query-aware CSS inspection helpers");
}

console.log(`Release validator contract: SALTA v${version} / test-config-from-tsconfig.json`);
console.log(`Release validation passed for SALTA v${version}.`);
