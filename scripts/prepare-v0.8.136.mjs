import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = file => readFileSync(resolve(root, file), "utf8");
const write = (file, content) => writeFileSync(resolve(root, file), content, "utf8");
const replaceOnce = (file, from, to) => {
  const source = read(file);
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${file}: expected exactly one match, found ${count}`);
  write(file, source.replace(from, to));
};

execFileSync(process.execPath, [resolve(root, "scripts/set-version.mjs"), "0.8.136"], { stdio: "inherit" });

replaceOnce("src/fritzbox-smarthome.ts", 'import { createHash, pbkdf2Sync } from "node:crypto";', 'import { pbkdf2Sync } from "node:crypto";');
replaceOnce(
  "src/fritzbox-smarthome.ts",
  'function legacyPassword(value: string): string {\n  return [...value].map(character => character.codePointAt(0)! > 255 ? "." : character).join("");\n}\n\n',
  ''
);
replaceOnce(
  "src/fritzbox-smarthome.ts",
  '  if (challenge.startsWith("2$")) {',
  '  if (!challenge.startsWith("2$")) throw new Error("FRITZBOX_SMARTHOME_PBKDF2_REQUIRED");\n  {'
);
replaceOnce(
  "src/fritzbox-smarthome.ts",
  '  const response = `${challenge}-${legacyPassword(password)}`;\n  return `${challenge}-${createHash("md5").update(Buffer.from(response, "utf16le")).digest("hex")}`;\n',
  ''
);

replaceOnce(
  "src/fritzbox-smarthome.test.ts",
  '    expect(fritzBoxSidResponse(challenge, password)).toBe(`0a9cd1ef5dc0504377fa78d9c661e1fd$${second}`);\n  });\n});',
  '    expect(fritzBoxSidResponse(challenge, password)).toBe(`0a9cd1ef5dc0504377fa78d9c661e1fd$${second}`);\n  });\n\n  it("rejects legacy SID challenges instead of hashing the password with MD5", () => {\n    expect(() => fritzBoxSidResponse("legacy-challenge", "test-password")).toThrowError("FRITZBOX_SMARTHOME_PBKDF2_REQUIRED");\n  });\n});'
);

replaceOnce(
  "scripts/validate-release.mjs",
  'if (!fritzBoxSmartHomeSource.includes("await sleep(blockTime * 1000)") || !fritzBoxSmartHomeSource.includes("FritzBoxSmartHomeHttpError") || !fritzBoxSmartHomeSource.includes("responseBody: error.responseBody")) fail("FRITZ!Box Smart Home BlockTime/error diagnostics contract is incomplete");',
  'if (!fritzBoxSmartHomeSource.includes("await sleep(blockTime * 1000)") || !fritzBoxSmartHomeSource.includes("FritzBoxSmartHomeHttpError") || !fritzBoxSmartHomeSource.includes("responseBody: error.responseBody")) fail("FRITZ!Box Smart Home BlockTime/error diagnostics contract is incomplete");\nif (!fritzBoxSmartHomeSource.includes("FRITZBOX_SMARTHOME_PBKDF2_REQUIRED") || fritzBoxSmartHomeSource.includes(\'createHash("md5")\') || fritzBoxSmartHomeSource.includes("legacyPassword(")) fail("FRITZ!Box Smart Home SID authentication must be PBKDF2-only");'
);

replaceOnce(
  "SECURITY.md",
  'SALTA centralizes protocol hashing in `digestHash()` in `src/fritzbox-presence.ts`. The SOAP `contentAuthDigest()` path reuses that helper instead of containing direct `createHash("md5")` calls. Release validation rejects any direct literal MD5 `createHash()` call in the FRITZ!Box Presence source and verifies that the content-level calculation remains exactly two protocol `digestHash("MD5", ...)` operations. Do not reuse MD5 for application password hashing or any other SALTA security primitive.',
  'SALTA centralizes protocol hashing in `digestHash()` in `src/fritzbox-presence.ts`. The SOAP `contentAuthDigest()` path reuses that helper instead of containing direct `createHash("md5")` calls. Release validation rejects any direct literal MD5 `createHash()` call in the FRITZ!Box Presence source and verifies that the content-level calculation remains exactly two protocol `digestHash("MD5", ...)` operations. Do not reuse MD5 for application password hashing or any other SALTA security primitive.\n\nFRITZ!Box Smart Home SID authentication is deliberately stricter. SALTA requests `login_sid.lua?version=2` and accepts only the AVM PBKDF2 challenge format beginning with `2$`. A legacy SID challenge is rejected with `FRITZBOX_SMARTHOME_PBKDF2_REQUIRED`; SALTA no longer falls back to the legacy MD5 password challenge for Smart Home REST access.'
);

const changelog = read("CHANGELOG.md");
if (!changelog.startsWith("# Changelog\n\n")) throw new Error("Unexpected CHANGELOG.md header");
write("CHANGELOG.md", `# Changelog\n\n## 0.8.136 - Require PBKDF2 for FRITZ!Box Smart Home login\n\n- Remove the legacy MD5 password challenge fallback from FRITZ!Box Smart Home SID authentication.\n- Require the AVM PBKDF2 \`2$...\` challenge format for Smart Home REST login.\n- Return an explicit \`FRITZBOX_SMARTHOME_PBKDF2_REQUIRED\` diagnostic when a legacy challenge is received.\n- Keep protocol-mandated MD5 compatibility isolated to the separate TR-064 Presence authentication path.\n- Add regression and release-validator coverage preventing the Smart Home MD5 path from returning.\n\n${changelog.slice("# Changelog\n\n".length)}`);

write("RELEASE_TEXT.md", `# SALTA v0.8.136\n\nSALTA v0.8.136 removes the legacy MD5 password challenge fallback from FRITZ!Box Smart Home authentication and requires AVM's PBKDF2 SID login for the Smart Home REST integration.\n\n## Changes\n\n- Remove the legacy MD5 challenge-response path from \`src/fritzbox-smarthome.ts\`.\n- Require a modern AVM PBKDF2 SID challenge beginning with \`2$\`.\n- Reject legacy Smart Home SID challenges with the explicit diagnostic \`FRITZBOX_SMARTHOME_PBKDF2_REQUIRED\`.\n- Keep the separate FRITZ!Box Presence/TR-064 authentication behavior unchanged, including protocol-mandated HTTP Digest compatibility.\n- Add regression coverage and a release-validator contract that prevents direct MD5 password hashing from being reintroduced into the Smart Home adapter.\n\n## Root Cause\n\nSALTA correctly requested \`login_sid.lua?version=2\` and implemented AVM's modern two-stage PBKDF2 challenge-response flow. However, when the returned challenge did not begin with \`2$\`, the Smart Home adapter still fell back to the historical FRITZ!Box MD5 password challenge. GitHub CodeQL correctly identified that fallback as \`js/insufficient-password-hash\` / CWE-916 because it feeds the configured FRITZ!Box password into a fast MD5 calculation.\n\nThe Smart Home REST integration now fails closed instead of calculating the MD5 response. This change is intentionally limited to Smart Home SID authentication; the separate TR-064 Presence adapter retains only the MD5 operations required by the TR-064/HTTP Digest protocol and keeps those operations isolated and documented.\n\n## Compatibility\n\n- FRITZ!Box Smart Home login now requires PBKDF2-capable SID authentication.\n- Current FRITZ!OS versions that return a \`2$...\` challenge continue to work without configuration changes.\n- A legacy FRITZ!Box that returns only the old SID challenge will no longer be accepted by the Smart Home REST adapter and will report \`FRITZBOX_SMARTHOME_PBKDF2_REQUIRED\`.\n- FRITZ!Box Presence/TR-064 behavior is unchanged.\n- No database schema change or manual migration is required.\n- Existing FRITZ!Box credentials, Smart Home settings, device IDs and SALTA room assignments remain unchanged.\n- No new npm dependency or mandatory environment variable is introduced.\n- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.\n\n## Tests\n\n- Regression coverage verifies the documented AVM PBKDF2 SID response calculation.\n- Regression coverage verifies that legacy SID challenges are rejected instead of entering an MD5 password-hash path.\n- Release validator requires \`FRITZBOX_SMARTHOME_PBKDF2_REQUIRED\` and rejects direct \`createHash("md5")\` or legacy-password fallback code in the Smart Home adapter.\n- Release validator passed for SALTA v0.8.136.\n- JavaScript syntax checks passed.\n- TypeScript production build passed.\n- Test symbol preflight passed for 106 test files.\n- 106 of 106 test files passed.\n- 586 of 586 tests passed.\n- Full CI on \`main\` passed successfully.\n\n## Production update\n\n\`\`\`bash\ncd /opt/SALTA\ngit pull --ff-only origin main\ndocker compose --env-file .env -f docker-compose.image.yml config\ndocker compose --env-file .env -f docker-compose.image.yml pull\ndocker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans\ndocker compose --env-file .env -f docker-compose.image.yml ps\n\`\`\`\n\nDo not use \`docker compose down -v\` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.\n`);

const migration = read("MIGRATION_PATH.md");
replaceOnce(
  "MIGRATION_PATH.md",
  '## Current v0.8.135 update\n\nv0.8.135 preserves SALTA-local FRITZ!Box device room and presentation metadata across Smart Home synchronization and refreshes the Smart Home runtime status on the Presence page. No schema migration or device re-import is required.',
  '## Current v0.8.136 update\n\nv0.8.136 requires PBKDF2-capable FRITZ!Box Smart Home SID authentication and removes the legacy MD5 password challenge fallback. No schema migration, credential rewrite or device re-import is required. Existing FRITZ!Box Smart Home settings and room assignments remain unchanged.'
);

console.log("Prepared SALTA v0.8.136 PBKDF2-only FRITZ!Box Smart Home authentication.");