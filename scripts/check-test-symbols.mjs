import ts from "typescript";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const configPath = resolve(root, "tsconfig.tests.json");
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
}

const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root, undefined, configPath);
if (parsed.errors.length) {
  const message = ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  });
  throw new Error(message);
}

const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
const testFiles = program.getSourceFiles().filter((sourceFile) =>
  sourceFile.fileName.startsWith(resolve(root, "src")) && sourceFile.fileName.endsWith(".test.ts")
);

const unresolved = testFiles.flatMap((sourceFile) =>
  program.getSemanticDiagnostics(sourceFile).filter((diagnostic) => diagnostic.code === 2304 || diagnostic.code === 2552)
);

if (unresolved.length) {
  console.error("Test symbol preflight found unresolved identifiers:");
  console.error(ts.formatDiagnosticsWithColorAndContext(unresolved, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  }));
  process.exit(1);
}

console.log(`Test symbol preflight passed for ${testFiles.length} test files: no unresolved identifiers.`);

if (process.argv.includes("--vitest")) {
  const vitestEntry = resolve(root, "node_modules", "vitest", "vitest.mjs");
  if (!existsSync(vitestEntry)) {
    console.error(`Vitest executable is missing: ${vitestEntry}`);
    console.error("Run npm ci before npm test.");
    process.exit(1);
  }

  const env = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgres://salta_test:salta_test@127.0.0.1:5432/salta_test",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "salta-test-admin-password-123456",
    SALTA_HEALTH_TOKEN: process.env.SALTA_HEALTH_TOKEN ?? "salta-test-health-token-123456789012345678901234",
    SALTA_ENCRYPTION_KEY: process.env.SALTA_ENCRYPTION_KEY ?? "salta-test-encryption-key-123456",
    HOMEKIT_ENABLED: "false",
    LOG_LEVEL: "silent",
  };

  const result = spawnSync(process.execPath, [vitestEntry, "run", "--passWithNoTests"], {
    cwd: root,
    env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}
