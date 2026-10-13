import { readFileSync, writeFileSync } from "node:fs";

function replaceExact(file, from, to) {
  const source = readFileSync(file, "utf8");
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${file}: expected one occurrence of ${JSON.stringify(from)}, found ${count}`);
  writeFileSync(file, source.replace(from, to), "utf8");
}

replaceExact(
  "src/system-log-policy.ts",
  "      const current = grouped[previous.index];\n      const currentMeta = systemLogRepeatMeta(current);",
  "      const current = grouped[previous.index]!;\n      const currentMeta = systemLogRepeatMeta(current);"
);

replaceExact(
  "src/db.ts",
  "  if (!options.includeHidden && settings.hiddenPatterns.length) {",
  "  if (options.includeHidden === false && settings.hiddenPatterns.length) {"
);

console.log("Hardened v0.8.124 system-log aggregation typing and diagnostic visibility defaults.");
