import { readFileSync, writeFileSync } from "node:fs";

const file = "scripts/prepare-v0.8.133.mjs";
let source = readFileSync(file, "utf8");
const replacements = [
  ['calls.push(\\`${method} ${url}\\`);', 'calls.push(method + " " + url);'],
  ['throw new Error(\\`unexpected ${method} ${url}\\`);', 'throw new Error("unexpected " + method + " " + url);']
];
for (const [from, to] of replacements) {
  if (!source.includes(from)) throw new Error(`Missing preparation fragment: ${from}`);
  source = source.replace(from, to);
}
writeFileSync(file, source, "utf8");
console.log("Fixed v0.8.133 generated-test escaping.");
