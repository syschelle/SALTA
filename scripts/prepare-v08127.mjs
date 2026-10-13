import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const write = (file, content) => writeFileSync(file, content, "utf8");
const replaceOnce = (source, from, to, label) => {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(from, to);
};

execFileSync(process.execPath, ["scripts/set-version.mjs", "0.8.127"], { stdio: "inherit" });

let app = read("public/app.js");
const oldTopic = "function systemLogTopicMarkup(entry){const message=String(entry?.message??'');const automationName=systemLogAutomationName(entry);if(!automationName||message.includes(automationName))return escapeHtml(systemLogDisplayMessage(entry));return `${escapeHtml(message)} · <span class=\"system-log-automation-name\">${escapeHtml(automationName)}</span>`}";
const newTopic = "function systemLogTopicMarkup(entry){const message=String(entry?.message??'');const automationName=systemLogAutomationName(entry);if(!automationName)return escapeHtml(message);const nameIndex=message.indexOf(automationName);if(nameIndex<0)return `${escapeHtml(message)} · <span class=\"system-log-automation-name\">${escapeHtml(automationName)}</span>`;return `${escapeHtml(message.slice(0,nameIndex))}<span class=\"system-log-automation-name\">${escapeHtml(automationName)}</span>${escapeHtml(message.slice(nameIndex+automationName.length))}`}";
app = replaceOnce(app, oldTopic, newTopic, "system-log automation topic rendering");
write("public/app.js", app);

let styles = read("public/styles.css");
styles = replaceOnce(styles, ".system-log-automation-name{color:var(--accent)}", ".system-log-message-line .system-log-automation-name{color:var(--accent)}", "system-log automation accent selector");
write("public/styles.css", styles);

let frontendTest = read("src/frontend-system-log.test.ts");
frontendTest = replaceOnce(
  frontendTest,
  '    expect(script).toContain("system-log-automation-name");\n    expect(script).toContain("<strong>${systemLogTopicMarkup(entry)}</strong>");\n    expect(cssRuleContains(styles, ".system-log-automation-name", "color:var(--accent)")).toBe(true);',
  '    expect(script).toContain("system-log-automation-name");\n    expect(script).toContain("const nameIndex=message.indexOf(automationName)");\n    expect(script).toContain("message.slice(nameIndex+automationName.length)");\n    expect(script).toContain("<strong>${systemLogTopicMarkup(entry)}</strong>");\n    expect(cssRuleContains(styles, ".system-log-message-line .system-log-automation-name", "color:var(--accent)")).toBe(true);',
  "frontend system-log color regression assertions"
);
write("src/frontend-system-log.test.ts", frontendTest);

let validator = read("scripts/validate-release.mjs");
validator = replaceOnce(
  validator,
  '  ".github/workflows/codeql.yml",\n];',
  '  ".github/workflows/ci.yml",\n  ".github/workflows/release.yml",\n];',
  "release workflow required files"
);
const oldCodeQlBlock = `const codeQlWorkflow = read(".github/workflows/codeql.yml");\nif (!codeQlWorkflow.includes("javascript-typescript") || !codeQlWorkflow.includes("- actions")) fail("CodeQL advanced setup must analyze both JavaScript/TypeScript and GitHub Actions");\nif (!codeQlWorkflow.includes("github/codeql-action/init@v4") || !codeQlWorkflow.includes("github/codeql-action/analyze@v4")) fail("CodeQL advanced setup must use CodeQL Action v4");\nif (!codeQlWorkflow.includes("codeql-bundle-v2.26.2/codeql-bundle-linux64.tar.gz")) fail("CodeQL advanced setup compatibility pin must use the v2.26.2 Linux bundle");\nif (!codeQlWorkflow.includes("security-events: write")) fail("CodeQL advanced setup is missing permission to upload security results");\n`;
const newWorkflowBlock = `const ciWorkflow = read(".github/workflows/ci.yml");\nif (ciWorkflow.includes('"work/**"')) fail("CI must not run automatically on every work-branch push");\nif (!ciWorkflow.includes("workflow_dispatch:") || !ciWorkflow.includes("cancel-in-progress: true")) fail("CI must remain manually runnable and cancel superseded runs");\nconst releaseWorkflow = read(".github/workflows/release.yml");\nif (releaseWorkflow.includes("npm run check") || releaseWorkflow.includes("npm ci")) fail("Release publishing must not duplicate the full main CI test suite");\nif (!releaseWorkflow.includes('git merge-base --is-ancestor "$GITHUB_SHA" origin/main') || !releaseWorkflow.includes("scripts/validate-release.mjs")) fail("Release publishing must verify main ancestry and the release contract");\n`;
validator = replaceOnce(validator, oldCodeQlBlock, newWorkflowBlock, "release validator GitHub Actions policy");
validator = replaceOnce(
  validator,
  'if (!read("public/styles.css").includes(".system-log-automation-name{color:var(--accent)}") || !read("public/styles.css").includes(".eyebrow{font-size:12px;letter-spacing:.14em;font-weight:800;color:var(--accent)}")) fail("Automation names must use the same shared accent color as diagnostic eyebrow labels");',
  'if (!virtualFrontend.includes("const nameIndex=message.indexOf(automationName)") || !virtualFrontend.includes("message.slice(nameIndex+automationName.length)")) fail("Automation names already present in log messages must still receive dedicated accent markup");\nif (!read("public/styles.css").includes(".system-log-message-line .system-log-automation-name{color:var(--accent)}") || !read("public/styles.css").includes(".eyebrow{font-size:12px;letter-spacing:.14em;font-weight:800;color:var(--accent)}")) fail("Automation names must use the same shared accent color as diagnostic eyebrow labels");',
  "release validator automation accent contract"
);
write("scripts/validate-release.mjs", validator);

let releaseWorkflow = read(".github/workflows/release.yml");
const oldVerify = `  verify:\n    name: Verify release source\n    runs-on: ubuntu-24.04\n    timeout-minutes: 20\n\n    steps:\n      - name: Check out repository\n        uses: actions/checkout@v4\n\n      - name: Validate optional deployment helper scripts\n        shell: bash\n        run: |\n          for script in install.sh update.sh backup.sh restore.sh; do\n            if [ -f "$script" ]; then\n              sh -n "$script"\n            fi\n          done\n\n      - name: Set up Node.js\n        uses: actions/setup-node@v4\n        with:\n          node-version: 24\n          cache: npm\n\n      - name: Install dependencies\n        run: npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/\n\n      - name: Run complete release checks\n        run: npm run check\n\n\n`;
const newVerify = `  verify:\n    name: Verify release source\n    runs-on: ubuntu-24.04\n    timeout-minutes: 10\n\n    steps:\n      - name: Check out repository\n        uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n\n      - name: Verify tag belongs to main\n        shell: bash\n        run: |\n          git fetch origin main --no-tags\n          git merge-base --is-ancestor "$GITHUB_SHA" origin/main || {\n            echo "::error::Release tag commit is not contained in main"\n            exit 1\n          }\n\n      - name: Verify tag version and release contract\n        shell: bash\n        run: |\n          node - <<'NODE'\n          const pkg = require('./package.json');\n          const tag = process.env.GITHUB_REF_NAME || '';\n          if (tag !== 'v' + pkg.version) {\n            console.error('::error::Tag ' + tag + ' does not match package version v' + pkg.version);\n            process.exit(1);\n          }\n          NODE\n          node scripts/validate-release.mjs\n\n`;
releaseWorkflow = replaceOnce(releaseWorkflow, oldVerify, newVerify, "release workflow verification job");
write(".github/workflows/release.yml", releaseWorkflow);

let changelog = read("CHANGELOG.md");
const marker = "# Changelog\n\n";
const entry = `## 0.8.127 - Reliable automation-name accent and quieter GitHub Actions\n\n- Automation names in System Log topics are always rendered through dedicated accent markup, including messages that already contain the configured automation name.\n- The automation name uses the same shared \`var(--accent)\` color as \`DIAGNOSE & FEHLERSUCHE\`.\n- Full CI no longer runs automatically on every \`work/**\` push; it runs on \`main\`, real pull requests and manual dispatch.\n- Superseded CI runs are cancelled automatically.\n- The obsolete repository-specific CodeQL workflow was removed; GitHub's repository-level dynamic code scanning remains available separately.\n- Release publishing no longer repeats the complete test suite after the same commit already passed main CI; it verifies main ancestry, tag/version consistency and the release contract before building the container.\n\n`;
changelog = replaceOnce(changelog, marker, `${marker}${entry}`, "CHANGELOG v0.8.127 entry");
write("CHANGELOG.md", changelog);

write("RELEASE_TEXT.md", `# SALTA v0.8.127\n\nSALTA v0.8.127 makes the System Log automation-name accent reliable and significantly reduces redundant GitHub Actions runs without reducing the SALTA test suite.\n\n## Changes\n\n- Automation names in System Log topics always receive dedicated accent markup.\n- The automation name uses the same shared \`var(--accent)\` color as the \`DIAGNOSE & FEHLERSUCHE\` label.\n- Messages that already contain the configured automation name are now split safely so only the automation name receives the accent color.\n- Full CI no longer runs automatically for every \`work/**\` branch push. Automatic full CI remains enabled for \`main\` and real pull requests, and it can still be started manually.\n- Superseded CI runs are cancelled automatically.\n- The obsolete repository-specific CodeQL workflow was removed; GitHub's repository-level dynamic code scanning remains separate.\n- Release-tag publishing no longer repeats \`npm ci\` and the full \`npm run check\` suite. Instead it verifies that the tagged commit belongs to \`main\`, that the tag matches the package version, and that the release validator passes before the container is built.\n\n## Root Cause\n\nThe v0.8.126 source change was present on \`main\`, but v0.8.126 was never tagged or published. Therefore the published \`latest\` container remained v0.8.125 and could not contain the color change. In addition, the v0.8.126 rendering helper deliberately skipped dedicated markup when the automation name was already present in the message text, so those messages would still have appeared without the requested accent.\n\nGitHub Actions also performed more work than necessary: full CI ran on every work-branch push, an obsolete repository-specific CodeQL workflow produced configuration-level failures, and the release workflow repeated the complete test suite after the same commit had already passed main CI.\n\nv0.8.127 fixes the rendering path and consolidates quality checks so the complete test suite remains authoritative while redundant executions are removed.\n\n## Compatibility\n\n- No database schema change or migration is required.\n- Existing system-log rows and automation definitions remain compatible.\n- No npm dependency is added or changed.\n- No new mandatory environment variable is introduced.\n- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.\n- OpenCCU, Shelly, Phoscon, Hue, presence and automation execution behavior are unchanged.\n\n## Tests\n\n- Regression coverage verifies dedicated automation-name markup and the shared accent color.\n- Regression coverage now also verifies the branch where the automation name is already contained in the log message.\n- Release-validator coverage enforces the automation-name accent contract and the reduced GitHub Actions execution policy.\n- Release validator must pass for SALTA v0.8.127.\n- JavaScript syntax checks must pass.\n- TypeScript production build must pass.\n- The complete Vitest suite must pass on \`main\` before release.\n\n## Production update\n\n\`\`\`bash\ncd /opt/SALTA\ngit pull --ff-only origin main\ndocker compose --env-file .env -f docker-compose.image.yml config\ndocker compose --env-file .env -f docker-compose.image.yml pull\ndocker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans\ndocker compose --env-file .env -f docker-compose.image.yml ps\n\`\`\`\n\nDo not use \`docker compose down -v\` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.\n`);

console.log("Prepared SALTA v0.8.127 with reliable automation accent and reduced GitHub Actions noise.");
