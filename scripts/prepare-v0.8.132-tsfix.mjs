import { readFileSync, writeFileSync } from "node:fs";

const path = "src/fritzbox-smarthome.ts";
let source = readFileSync(path, "utf8");
source = source.replace(
  "function unitCategory(unit: SmartHomeUnit, parent: SmartHomeDevice | undefined):",
  "function unitCategory(unit: SmartHomeUnit):"
);
source = source.replace("const category = unitCategory(unit, parent);", "const category = unitCategory(unit);");
writeFileSync(path, source, "utf8");
