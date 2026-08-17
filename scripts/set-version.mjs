import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const nextVersion = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(nextVersion ?? "")) throw new Error("Usage: npm run version:set -- <major.minor.patch>");

const pathFor = (file) => resolve(root, file);
const read = (file) => readFileSync(pathFor(file), "utf8");
const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
const previousVersion = String(packageJson.version);

if (!/^\d+\.\d+\.\d+$/.test(previousVersion)) throw new Error(`Current package version is invalid: ${previousVersion}`);
if (previousVersion === nextVersion) throw new Error(`SALTA is already at version ${nextVersion}`);
if (packageLock.version !== previousVersion || packageLock.packages?.[""]?.version !== previousVersion) {
  throw new Error("Refusing to bump: package.json and package-lock.json root versions are inconsistent");
}

// Update only active release/version surfaces. Historical compatibility text
// must never be rewritten just because it contains the previous release number.
const updates = new Map();
const stageReplace = (file, replacements) => {
  let source = updates.get(file) ?? read(file);
  for (const { from, to, count = 1 } of replacements) {
    const occurrences = source.split(from).length - 1;
    if (occurrences !== count) {
      throw new Error(`Refusing to bump: ${file} expected ${count} occurrence(s) of ${JSON.stringify(from)}, found ${occurrences}`);
    }
    source = source.split(from).join(to);
  }
  updates.set(file, source);
};

stageReplace(".env.example", [
  { from: `# SALTA v${previousVersion}`, to: `# SALTA v${nextVersion}` },
  { from: `SALTA_IMAGE=ghcr.io/syschelle/salta:${previousVersion}`, to: `SALTA_IMAGE=ghcr.io/syschelle/salta:${nextVersion}` },
]);
stageReplace("docker-compose.image.yml", [
  { from: `ghcr.io/syschelle/salta:${previousVersion}`, to: `ghcr.io/syschelle/salta:${nextVersion}` },
]);
stageReplace("public/index.html", [
  { from: `Version <strong>${previousVersion}</strong>`, to: `Version <strong>${nextVersion}</strong>` },
]);
stageReplace("src/server.ts", [
  { from: `version: "${previousVersion}"`, to: `version: "${nextVersion}"`, count: 2 },
  { from: `createDisasterRecoveryBackup("${previousVersion}"`, to: `createDisasterRecoveryBackup("${nextVersion}"` },
]);
stageReplace("src/homekit.ts", [
  { from: `FirmwareRevision, "${previousVersion}"`, to: `FirmwareRevision, "${nextVersion}"` },
  { from: `device.firmwareVersion || "${previousVersion}"`, to: `device.firmwareVersion || "${nextVersion}"` },
]);
stageReplace("src/deployment-config.test.ts", [
  { from: `ghcr.io/syschelle/salta:${previousVersion}`, to: `ghcr.io/syschelle/salta:${nextVersion}` },
]);
stageReplace("src/server.test.ts", [
  { from: `version: "${previousVersion}"`, to: `version: "${nextVersion}"` },
  { from: `saltaVersion: "${previousVersion}"`, to: `saltaVersion: "${nextVersion}"` },
  { from: `createDisasterRecoveryBackup).toHaveBeenCalledWith("${previousVersion}"`, to: `createDisasterRecoveryBackup).toHaveBeenCalledWith("${nextVersion}"` },
]);
stageReplace("docs-ghcr.md", [
  { from: `# Publish SALTA v${previousVersion} to GHCR`, to: `# Publish SALTA v${nextVersion} to GHCR` },
  { from: `git tag -a v${previousVersion} -m "SALTA v${previousVersion}"`, to: `git tag -a v${nextVersion} -m "SALTA v${nextVersion}"` },
  { from: `git push origin v${previousVersion}`, to: `git push origin v${nextVersion}` },
  { from: `ghcr.io/syschelle/salta:${previousVersion}`, to: `ghcr.io/syschelle/salta:${nextVersion}` },
]);
stageReplace("RELEASE_TEXT.md", [
  { from: `# SALTA v${previousVersion}`, to: `# SALTA v${nextVersion}` },
]);
stageReplace("MIGRATION_PATH.md", [
  { from: `## Current v${previousVersion} update`, to: `## Current v${nextVersion} update` },
]);
stageReplace("GIT_COMMANDS.md", [
  { from: `# SALTA v${previousVersion} Git commands`, to: `# SALTA v${nextVersion} Git commands` },
  { from: `Release validator contract: SALTA v${previousVersion} / test-config-from-tsconfig.json`, to: `Release validator contract: SALTA v${nextVersion} / test-config-from-tsconfig.json` },
  { from: `Release validation passed for SALTA v${previousVersion}.`, to: `Release validation passed for SALTA v${nextVersion}.` },
  { from: `git tag -a v${previousVersion} -m "SALTA v${previousVersion}"`, to: `git tag -a v${nextVersion} -m "SALTA v${nextVersion}"` },
  { from: `git push origin v${previousVersion}`, to: `git push origin v${nextVersion}` },
  { from: `gh release create v${previousVersion}`, to: `gh release create v${nextVersion}` },
  { from: `--title "SALTA v${previousVersion}"`, to: `--title "SALTA v${nextVersion}"` },
]);

if (existsSync(pathFor("install.sh"))) {
  stageReplace("install.sh", [
    { from: `SALTA v${previousVersion} is starting.`, to: `SALTA v${nextVersion} is starting.` },
  ]);
}

packageJson.version = nextVersion;
packageLock.version = nextVersion;
packageLock.packages[""].version = nextVersion;
updates.set("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
updates.set("package-lock.json", `${JSON.stringify(packageLock, null, 2)}\n`);

if (existsSync(pathFor("RELEASE_MANIFEST.md"))) {
  const composeContent = updates.get("docker-compose.image.yml") ?? read("docker-compose.image.yml");
  const migrationBytes = readFileSync(pathFor("migrate-homekit-storage.sh"));
  const composeHash = createHash("sha256").update(composeContent).digest("hex");
  const migrationHash = createHash("sha256").update(migrationBytes).digest("hex");
  updates.set("RELEASE_MANIFEST.md", `# SALTA v${nextVersion} release manifest\n\nThis manifest is intended for post-push verification before tagging the release.\n\n## Production deployment file\n\n\`\`\`text\ndocker-compose.image.yml  SHA-256  ${composeHash}\n\`\`\`\n\nRequired topology:\n\n- SALTA uses \`network_mode: host\`.\n- PostgreSQL uses Docker's normal bridge network.\n- PostgreSQL is published only on \`127.0.0.1:\${POSTGRES_HOST_PORT:-5433}:5432\`.\n- No custom \`networks:\` section or \`internal: true\` network exists in the production Compose file.\n\n## Legacy HomeKit migration helper\n\n\`\`\`text\nmigrate-homekit-storage.sh  SHA-256  ${migrationHash}\n\`\`\`\n\nProduction host path:\n\n\`\`\`text\n/opt/SALTA/migrate-homekit-storage.sh\n\`\`\`\n\nThis helper is only required for HomeKit pairing state created before v0.8.41.\n`);
}

for (const [file, content] of updates) writeFileSync(pathFor(file), content, "utf8");

console.log(`Updated SALTA root version ${previousVersion} -> ${nextVersion}.`);
console.log("Historical compatibility references were intentionally left unchanged.");
console.log("Review CHANGELOG.md and RELEASE_TEXT.md for the new release before tagging.");
console.log("No transitive dependency version or integrity field was modified.");
