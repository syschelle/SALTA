import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const write = (file, content) => writeFileSync(file, content, "utf8");
const replaceOnce = (source, from, to, label) => {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(from, to);
};

execFileSync(process.execPath, ["scripts/set-version.mjs", "0.8.125"], { stdio: "inherit" });

let app = read("public/app.js");
const renderMarker = "function renderSystemLogs(){";
const messageHelper = "function systemLogDisplayMessage(entry){const message=String(entry?.message??'');const automationName=entry?.source==='automation'&&typeof entry?.details?.automationName==='string'?entry.details.automationName.trim():'';return automationName&&!message.includes(automationName)?`${message} · ${automationName}`:message}\n";
app = replaceOnce(app, renderMarker, `${messageHelper}${renderMarker}`, "public/app.js helper insertion");
app = replaceOnce(app, "<strong>${escapeHtml(entry.message)}</strong>", "<strong>${escapeHtml(systemLogDisplayMessage(entry))}</strong>", "public/app.js visible log topic");
write("public/app.js", app);

let frontendTest = read("src/frontend-system-log.test.ts");
const testMarker = '  it("keeps detailed OpenCCU errors visible and links them to the log", () => {';
const topicTest = `  it("shows automation names directly in system-log topics", () => {\n    expect(script).toContain("function systemLogDisplayMessage(entry)");\n    expect(script).toContain("entry?.source==='automation'");\n    expect(script).toContain("entry?.details?.automationName");\n    expect(script).toContain("escapeHtml(systemLogDisplayMessage(entry))");\n  });\n\n`;
frontendTest = replaceOnce(frontendTest, testMarker, `${topicTest}${testMarker}`, "frontend system-log regression test");
write("src/frontend-system-log.test.ts", frontendTest);

let validator = read("scripts/validate-release.mjs");
const validatorMarker = 'const virtualFrontend = read("public/app.js");';
const validatorRule = 'if (!virtualFrontend.includes("function systemLogDisplayMessage(entry)") || !virtualFrontend.includes("entry?.source===\'automation\'") || !virtualFrontend.includes("entry?.details?.automationName") || !virtualFrontend.includes("escapeHtml(systemLogDisplayMessage(entry))")) fail("Automation names are missing from visible system-log topics");';
validator = replaceOnce(validator, validatorMarker, `${validatorMarker}\n${validatorRule}`, "release validator automation log topic contract");
write("scripts/validate-release.mjs", validator);

let changelog = read("CHANGELOG.md");
const changelogMarker = "# Changelog\n\n";
const changelogEntry = `## 0.8.125 - Automation names in system-log topics\n\n- Automation system-log topics now append the configured automation name when \`details.automationName\` is available.\n- The change applies consistently to automation start, step, wait, failure, finish and triggered entries without opening the details panel.\n- Technical log codes, stored details, filtering, repeat aggregation and automation execution semantics remain unchanged.\n\n`;
changelog = replaceOnce(changelog, changelogMarker, `${changelogMarker}${changelogEntry}`, "CHANGELOG.md release entry");
write("CHANGELOG.md", changelog);

write("RELEASE_TEXT.md", `# SALTA v0.8.125\n\nSALTA v0.8.125 makes automation events easier to identify in the System Log by showing the configured automation name directly in the visible log topic.\n\n## Changes\n\n- Automation log topics now append the configured automation name when it is present in the existing diagnostic details.\n- A visible entry such as \`Automation executed\` can now appear as \`Automation executed · Nachtabsenkung\`.\n- The behavior applies consistently to automation execution start, wait, action, failure, finish and triggered messages that already carry \`automationName\`.\n- The technical log code remains unchanged and stays visible next to the topic.\n- The complete automation diagnostic details remain available through the existing expandable Details section and sanitized diagnostic export.\n- System-log filtering and repeat aggregation introduced in v0.8.124 are unchanged.\n\n## Root Cause\n\nSALTA already stored the automation ID and configured automation name in the diagnostic details of automation execution log entries. The System Log overview, however, rendered only the generic \`message\` field as its visible topic. Users therefore had to open the Details section to determine which automation produced an entry such as \`AUTOMATION_TRIGGERED\`.\n\nv0.8.125 reuses the existing \`details.automationName\` value in the presentation layer and appends it to the visible topic. No automation execution or persistence behavior is changed.\n\n## Compatibility\n\n- No database schema change or migration is required.\n- Existing system-log rows remain compatible.\n- Existing automation definitions require no editing.\n- System-log filtering, repeat aggregation and diagnostic export remain compatible.\n- No npm dependency is added or changed.\n- No new mandatory environment variable is introduced.\n- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.\n- OpenCCU, Shelly, Phoscon, Hue and presence integrations are unchanged.\n\n## Tests\n\n- Regression coverage verifies that automation log topics use the existing \`automationName\` diagnostic field.\n- Release-validator coverage requires the automation-name presentation contract.\n- Release validator, JavaScript syntax checks, TypeScript production build and complete test suite are executed by GitHub Actions before release.\n\n## Production update\n\n\`\`\`bash\ncd /opt/SALTA\ngit pull --ff-only origin main\ndocker compose --env-file .env -f docker-compose.image.yml config\ndocker compose --env-file .env -f docker-compose.image.yml pull\ndocker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans\ndocker compose --env-file .env -f docker-compose.image.yml ps\n\`\`\`\n\nDo not use \`docker compose down -v\` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.\n`);

console.log("Prepared SALTA v0.8.125 automation-name system-log topic change.");
