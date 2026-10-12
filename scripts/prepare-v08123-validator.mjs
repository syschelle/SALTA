import { readFileSync, writeFileSync } from "node:fs";

const file = "scripts/validate-release.mjs";
const source = readFileSync(file, "utf8");
const from = '.automation-list{display:grid;gap:8px}';
const to = '.automation-list{display:grid;gap:16px}';
const count = source.split(from).length - 1;
if (count !== 1) throw new Error(`Expected one compact automation-list validator contract, found ${count}`);
writeFileSync(file, source.replace(from, to), "utf8");
console.log("Updated the compact automation-list validator contract for room grouping.");
