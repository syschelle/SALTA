import { readFileSync, writeFileSync } from "node:fs";

const file = "src/openccu-adapter.ts";
let source = readFileSync(file, "utf8");
const from = `        const previousContactEventMetadata = existing?.type === "contactSensor" && discovered.type === "contactSensor"\n          ? Object.fromEntries(["stateEventOrigin", "stateEventTransport", "stateEventParameter", "stateEventValue", "stateEventLastUpdated"]\n              .filter(key => existing.adapterData?.[key] !== undefined)\n              .map(key => [key, existing.adapterData?.[key]]))\n          : {};`;
const to = `        const previousContactEventMetadata: Record<string, string | number | boolean | null> = {};\n        if (existing?.type === "contactSensor" && discovered.type === "contactSensor") {\n          for (const key of ["stateEventOrigin", "stateEventTransport", "stateEventParameter", "stateEventValue", "stateEventLastUpdated"]) {\n            const value = existing.adapterData?.[key];\n            if (value !== undefined) previousContactEventMetadata[key] = value;\n          }\n        }`;
const count = source.split(from).length - 1;
if (count !== 1) throw new Error(`Expected one generated contact metadata block, found ${count}`);
source = source.replace(from, to);
const pollValueFrom = `                stateEventValue: discovered.state.open,`;
const pollValueTo = `                stateEventValue: typeof discovered.state.open === "boolean" ? discovered.state.open : null,`;
const pollValueCount = source.split(pollValueFrom).length - 1;
if (pollValueCount !== 1) throw new Error(`Expected one generated poll contact value, found ${pollValueCount}`);
source = source.replace(pollValueFrom, pollValueTo);
writeFileSync(file, source, "utf8");
console.log("Applied v0.8.128 TypeScript-safe contact metadata copy.");
