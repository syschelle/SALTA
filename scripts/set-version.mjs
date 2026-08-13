import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const nextVersion = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(nextVersion ?? "")) {
  throw new Error("Usage: npm run version:set -- <major.minor.patch>");
}

const pathFor = (file) => resolve(root, file);
const read = (file) => readFileSync(pathFor(file), "utf8");
const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
const previousVersion = String(packageJson.version);

if (!/^\d+\.\d+\.\d+$/.test(previousVersion)) {
  throw new Error(`Current package version is invalid: ${previousVersion}`);
}
if (previousVersion === nextVersion) {
  throw new Error(`SALTA is already at version ${nextVersion}`);
}
if (packageLock.version !== previousVersion || packageLock.packages?.[""]?.version !== previousVersion) {
  throw new Error("Refusing to bump: package.json and package-lock.json root versions are inconsistent");
}

const versionFiles = [
  ".env.example",
  "docker-compose.image.yml",
  "docs-ghcr.md",
  "public/index.html",
  "src/server.ts",
  "src/deployment-config.test.ts",
  "src/server.test.ts",
  "RELEASE_TEXT.md",
  "GIT_COMMANDS.md",
];

// Build every output in memory first. No file is written until all release
// surfaces have been validated, preventing a partially applied version bump.
const updates = new Map();
for (const file of versionFiles) {
  const source = read(file);
  if (!source.includes(previousVersion)) {
    throw new Error(`Refusing to bump: ${file} does not contain ${previousVersion}`);
  }
  updates.set(file, source.replaceAll(previousVersion, nextVersion));
}

// Convenience deployment helpers are optional in the repository. Update their
// embedded version marker when present without making releases depend on them.
for (const file of ["install.sh"]) {
  if (!existsSync(pathFor(file))) continue;
  const source = read(file);
  if (source.includes(previousVersion)) updates.set(file, source.replaceAll(previousVersion, nextVersion));
}

packageJson.version = nextVersion;
packageLock.version = nextVersion;
packageLock.packages[""].version = nextVersion;
updates.set("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
updates.set("package-lock.json", `${JSON.stringify(packageLock, null, 2)}\n`);

for (const [file, content] of updates) {
  writeFileSync(pathFor(file), content, "utf8");
}

console.log(`Updated SALTA root version ${previousVersion} -> ${nextVersion}.`);
console.log("No transitive dependency version or integrity field was modified.");
