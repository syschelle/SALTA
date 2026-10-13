import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const write = (file, content) => writeFileSync(file, content, "utf8");
const replaceOnce = (source, from, to, label) => {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(from, to);
};

execFileSync(process.execPath, ["scripts/set-version.mjs", "0.8.126"], { stdio: "inherit" });

let app = read("public/app.js");
const oldDisplay = "function systemLogDisplayMessage(entry){const message=String(entry?.message??'');const automationName=entry?.source==='automation'&&typeof entry?.details?.automationName==='string'?entry.details.automationName.trim():'';return automationName&&!message.includes(automationName)?`${message} · ${automationName}`:message}";
const newDisplay = "function systemLogAutomationName(entry){return entry?.source==='automation'&&typeof entry?.details?.automationName==='string'?entry.details.automationName.trim():''}\nfunction systemLogDisplayMessage(entry){const message=String(entry?.message??'');const automationName=systemLogAutomationName(entry);return automationName&&!message.includes(automationName)?`${message} · ${automationName}`:message}\nfunction systemLogTopicMarkup(entry){const message=String(entry?.message??'');const automationName=systemLogAutomationName(entry);if(!automationName||message.includes(automationName))return escapeHtml(systemLogDisplayMessage(entry));return `${escapeHtml(message)} · <span class=\"system-log-automation-name\">${escapeHtml(automationName)}</span>`}";
app = replaceOnce(app, oldDisplay, newDisplay, "public/app.js system log helpers");
app = replaceOnce(app, "<strong>${escapeHtml(systemLogDisplayMessage(entry))}</strong>", "<strong>${systemLogTopicMarkup(entry)}</strong>", "public/app.js system log topic markup");
write("public/app.js", app);

let styles = read("public/styles.css");
styles = replaceOnce(
  styles,
  ".system-log-message-line strong{font-size:13px;line-height:1.35}",
  ".system-log-message-line strong{font-size:13px;line-height:1.35}.system-log-automation-name{color:var(--accent)}",
  "public/styles.css automation name accent"
);
write("public/styles.css", styles);

let frontendTest = read("src/frontend-system-log.test.ts");
const oldTest = `  it("shows automation names directly in system-log topics", () => {\n    expect(hasFunction(appAst, "systemLogDisplayMessage")).toBe(true);\n    expect(script).toContain("entry?.source==='automation'");\n    expect(script).toContain("entry?.details?.automationName");\n    expect(script).toContain("escapeHtml(systemLogDisplayMessage(entry))");\n  });`;
const newTest = `  it("shows automation names directly in system-log topics using the shared accent color", () => {\n    expect(hasFunction(appAst, "systemLogAutomationName")).toBe(true);\n    expect(hasFunction(appAst, "systemLogDisplayMessage")).toBe(true);\n    expect(hasFunction(appAst, "systemLogTopicMarkup")).toBe(true);\n    expect(script).toContain("entry?.source==='automation'");\n    expect(script).toContain("entry?.details?.automationName");\n    expect(script).toContain("system-log-automation-name");\n    expect(script).toContain("<strong>\\${systemLogTopicMarkup(entry)}</strong>");\n    expect(cssRuleContains(styles, ".system-log-automation-name", "color:var(--accent)")).toBe(true);\n    expect(cssRuleContains(styles, ".eyebrow", "color:var(--accent)")).toBe(true);\n  });`;
frontendTest = replaceOnce(frontendTest, oldTest, newTest, "frontend system-log accent test");
write("src/frontend-system-log.test.ts", frontendTest);

let validator = read("scripts/validate-release.mjs");
const oldValidator = 'if (!virtualFrontend.includes("function systemLogDisplayMessage(entry)") || !virtualFrontend.includes("entry?.source===\'automation\'") || !virtualFrontend.includes("entry?.details?.automationName") || !virtualFrontend.includes("escapeHtml(systemLogDisplayMessage(entry))")) fail("Automation names are missing from visible system-log topics");';
const newValidator = 'if (!virtualFrontend.includes("function systemLogAutomationName(entry)") || !virtualFrontend.includes("function systemLogDisplayMessage(entry)") || !virtualFrontend.includes("function systemLogTopicMarkup(entry)") || !virtualFrontend.includes("system-log-automation-name") || !virtualFrontend.includes("<strong>${systemLogTopicMarkup(entry)}</strong>")) fail("Automation names are missing from visible system-log topics");\nif (!publicStyles.includes(".system-log-automation-name{color:var(--accent)}") || !publicStyles.includes(".eyebrow{font-size:12px;letter-spacing:.14em;font-weight:800;color:var(--accent)}")) fail("Automation names must use the same shared accent color as diagnostic eyebrow labels");';
validator = replaceOnce(validator, oldValidator, newValidator, "release validator automation log accent contract");
write("scripts/validate-release.mjs", validator);

let changelog = read("CHANGELOG.md");
const changelogMarker = "# Changelog\n\n";
const changelogEntry = `## 0.8.126 - Accent-colored automation names in system log\n\n- Automation names shown in system-log topics now use SALTA's shared accent color.\n- The color is the same \`var(--accent)\` token used by the \`DIAGNOSE & FEHLERSUCHE\` eyebrow label.\n- Only the automation name is colored; the generic log message, separator and technical log code remain unchanged.\n- The styling follows light/dark mode and configured SALTA appearance profiles automatically.\n\n`;
changelog = replaceOnce(changelog, changelogMarker, `${changelogMarker}${changelogEntry}`, "CHANGELOG.md release entry");
write("CHANGELOG.md", changelog);

write("RELEASE_TEXT.md", `# SALTA v0.8.126\n\nSALTA v0.8.126 visually separates automation names in the System Log by using the same shared accent color as the \`DIAGNOSE & FEHLERSUCHE\` label.\n\n## Changes\n\n- Automation names appended to System Log topics are now rendered as a dedicated element.\n- Only the automation name uses SALTA's shared \`var(--accent)\` color; the message text, separator and technical log code keep their existing appearance.\n- The automation-name color therefore follows SALTA light/dark mode and configured appearance profiles automatically.\n- Existing automation names continue to come from the already stored \`details.automationName\` diagnostic field.\n- Automation execution, log persistence, filtering, repeat aggregation and diagnostic export are unchanged.\n\n## Root Cause\n\nv0.8.125 made the automation name visible directly in the System Log topic, but it was rendered inside the same escaped text node as the generic log message. This made the name readable without opening Details, but it could not be styled independently.\n\nv0.8.126 renders only the automation name in a dedicated span and assigns the existing shared accent token used by the System Log's \`DIAGNOSE & FEHLERSUCHE\` eyebrow. No new hard-coded color is introduced.\n\n## Compatibility\n\n- No database schema change or migration is required.\n- Existing system-log rows remain compatible.\n- Existing automation definitions require no editing.\n- No npm dependency is added or changed.\n- No new mandatory environment variable is introduced.\n- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.\n- OpenCCU, Shelly, Phoscon, Hue and presence integrations are unchanged.\n\n## Tests\n\n- Regression coverage verifies dedicated automation-name topic markup.\n- Regression coverage verifies that the automation-name style and the diagnostic eyebrow both use \`var(--accent)\`.\n- Release-validator coverage enforces the same shared accent-color contract.\n- Release validator, JavaScript syntax checks, TypeScript production build and complete test suite are executed by GitHub Actions before release.\n\n## Production update\n\n\`\`\`bash\ncd /opt/SALTA\ngit pull --ff-only origin main\ndocker compose --env-file .env -f docker-compose.image.yml config\ndocker compose --env-file .env -f docker-compose.image.yml pull\ndocker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans\ndocker compose --env-file .env -f docker-compose.image.yml ps\n\`\`\`\n\nDo not use \`docker compose down -v\` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.\n`);

console.log("Prepared SALTA v0.8.126 automation-name accent styling.");
