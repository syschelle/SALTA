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
if (!serverSource.includes('"/api/automations"')) fail("Automation API routes are missing");
if (!automationEngineSource.includes('source: "automation"')) fail("Automation commands do not use the shared automation source");
if (!automationEngineSource.includes('AUTOMATION_CYCLE_NOT_ALLOWED')) fail("Automation loop protection is missing");
if (!mainSource.includes("await automations.start()")) fail("Automation engine is not started during SALTA startup");
if (!mainSource.includes("automations.stop()")) fail("Automation engine is not stopped during SALTA shutdown");
const automationPersistenceSource = read("src/automation-persistence.ts");
if (automationEngineSource.includes('from "./db.js"')) fail("automation core must not import the database/configuration layer directly");
if (!automationPersistenceSource.includes('from "./db.js"')) fail("automation persistence adapter is not wired to the database layer");
if (!mainSource.includes("databaseAutomationStore, databaseAutomationLogger")) fail("main does not inject automation persistence and logging adapters");
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
}

const densityTest = read("src/frontend-device-density.test.ts");
if (densityTest.includes("latestRule(")) {
  fail("frontend-device-density.test.ts must inspect all matching CSS rules instead of only the last media-query override");
}
if (!densityTest.includes("cssRuleContains")) {
  fail("frontend-device-density.test.ts must use the shared CSS rule inspection helper");
}

const openCcuControlTest = read("src/openccu-control.test.ts");
if (!openCcuControlTest.includes("functionTransitivelyCalls")) {
  fail("openccu-control.test.ts must follow the renderer call graph through composed control helpers");
}

console.log(`Release validation passed for SALTA v${version}.`);
