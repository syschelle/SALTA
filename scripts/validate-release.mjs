import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const fail = (message) => {
  throw new Error(`Release validation failed: ${message}`);
};

const publicIndex = read("public/index.html");
const roomGroupingScript = '<script src="/room-grouping.js"></script>';
const appScript = '<script src="/app.js"></script>';
if (!publicIndex.includes(roomGroupingScript)) fail("public/index.html does not load room-grouping.js");
if (publicIndex.indexOf(roomGroupingScript) > publicIndex.indexOf(appScript)) fail("room-grouping.js must load before app.js");
const serverSource = read("src/server.ts");
if (!serverSource.includes('["/room-grouping.js", "room-grouping.js"]')) fail("server does not serve room-grouping.js");
if (!serverSource.includes('immutableVendorAsset ? "public, max-age=31536000, immutable" : "no-store"')) fail("application assets are not protected from stale browser caching");

const packageJson = json("package.json");
const packageLock = json("package-lock.json");
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
