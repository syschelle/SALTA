import ts from "typescript";
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
