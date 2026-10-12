import { readFileSync, writeFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const write = (file, content) => writeFileSync(file, content, "utf8");

const replaceExact = (file, from, to) => {
  const source = read(file);
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${file}: expected one occurrence of ${JSON.stringify(from)}, found ${count}`);
  write(file, source.replace(from, to));
};

let ui = read("public/automation-ui.js");
const renderStart = ui.indexOf("function renderAutomations(){");
const renderEnd = ui.indexOf("\nasync function loadAutomations()", renderStart);
if (renderStart < 0 || renderEnd < 0) throw new Error("Could not locate renderAutomations block");

const roomGroupingHelper = `function automationRoomGroups(){
  const groups=rooms.map(room=>({room,rules:automationRules.filter(rule=>rule.roomId===room.id)})).filter(group=>group.rules.length);
  const unassigned=automationRules.filter(rule=>!automationRoomById(rule.roomId));
  if(unassigned.length)groups.push({room:null,rules:unassigned});
  return groups;
}
`;
ui = ui.slice(0, renderStart) + roomGroupingHelper + ui.slice(renderStart);

const groupedListStart = "automationElements.list.innerHTML=automationRoomGroups().map(group=>{const room=group.room;const title=room?.name||'Ohne Raum';return `<section class=\"automation-room-group\"><div class=\"automation-room-group-head\"><span class=\"automation-room-group-icon\">${iconMarkup(room?.icon||'home-outline')}</span><h2 ${room?'data-i18n-skip':''}>${escapeHtml(title)}</h2><span class=\"automation-room-group-count\">${group.rules.length}</span></div><div class=\"automation-room-group-items\">${group.rules.map(rule=>{";
const flatListStart = "automationElements.list.innerHTML=automationRules.map(rule=>{";
const flatListCount = ui.split(flatListStart).length - 1;
if (flatListCount !== 1) throw new Error(`Expected one flat automation list render, found ${flatListCount}`);
ui = ui.replace(flatListStart, groupedListStart);

const flatListEnd = "</article>`}).join('');\n}";
const groupedListEnd = "</article>`}).join('')}</div></section>`}).join('');\n}";
const flatListEndCount = ui.split(flatListEnd).length - 1;
if (flatListEndCount !== 1) throw new Error(`Expected one flat automation list ending, found ${flatListEndCount}`);
ui = ui.replace(flatListEnd, groupedListEnd);
write("public/automation-ui.js", ui);

replaceExact(
  "public/styles.css",
  ".automation-list{display:grid;gap:8px}",
  ".automation-list{display:grid;gap:16px}.automation-room-group{display:grid;gap:7px}.automation-room-group-head{display:flex;align-items:center;gap:7px;padding:0 2px}.automation-room-group-head h2{margin:0;font-size:13px;line-height:1.2}.automation-room-group-icon{width:24px;height:24px;border-radius:7px;background:var(--accent-bg);color:var(--accent);display:grid;place-items:center;flex:0 0 auto}.automation-room-group-icon .mdi{font-size:14px}.automation-room-group-count{min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:var(--subtle-bg);border:1px solid var(--line);color:var(--muted);display:inline-grid;place-items:center;font-size:10px;font-weight:800}.automation-room-group-items{display:grid;gap:8px}"
);

replaceExact(
  "public/i18n/de.json",
  '    "Keinem Raum zugeordnet": "Keinem Raum zugeordnet",',
  '    "Keinem Raum zugeordnet": "Keinem Raum zugeordnet",\n    "Ohne Raum": "Ohne Raum",'
);
replaceExact(
  "public/i18n/en.json",
  '    "Keinem Raum zugeordnet": "Not assigned to a room",',
  '    "Keinem Raum zugeordnet": "Not assigned to a room",\n    "Ohne Raum": "Without room",'
);

let test = read("src/frontend-automations.test.ts");
const oldGapAssertion = 'expect(cssRuleContains(styles, ".automation-list", "gap:8px")).toBe(true);';
const newGapAssertion = 'expect(cssRuleContains(styles, ".automation-list", "gap:16px")).toBe(true);';
if (!test.includes(oldGapAssertion)) throw new Error("Could not locate compact automation-list gap assertion");
test = test.replace(oldGapAssertion, newGapAssertion);

const testAnchor = '  it("keeps compact automation cards responsive on mobile", () => {';
const groupingTest = `  it("groups automation cards in configured room order and keeps unassigned rules last", () => {
    expect(hasFunction(uiAst, "automationRoomGroups")).toBe(true);
    expect(ui).toContain('class="automation-room-group"');
    expect(ui).toContain("room?.name||'Ohne Raum'");
    expect(cssRuleContains(styles, ".automation-room-group-items", "display:grid")).toBe(true);
    expect(cssRuleContains(styles, ".automation-room-group-items", "gap:8px")).toBe(true);
    const sandbox: Record<string, unknown> = {
      document: { getElementById: () => null, querySelectorAll: () => [] },
      all: [],
      rooms: [
        { id: "bad", name: "Bad", icon: "bathtub-outline" },
        { id: "living", name: "Wohnzimmer", icon: "sofa-outline" },
      ],
      labels: {},
      sourceLabels: {},
      typeLabels: {},
      console,
    };
    runInNewContext(ui+"\\nautomationRules=[{id:'living-a',roomId:'living'},{id:'none-a',roomId:null},{id:'bad-a',roomId:'bad'},{id:'missing-a',roomId:'missing'}];globalThis.__roomGroups=automationRoomGroups().map(group=>({roomId:group.room?.id??null,ruleIds:group.rules.map(rule=>rule.id)}));", sandbox);
    expect(sandbox.__roomGroups).toEqual([
      { roomId: "bad", ruleIds: ["bad-a"] },
      { roomId: "living", ruleIds: ["living-a"] },
      { roomId: null, ruleIds: ["none-a", "missing-a"] },
    ]);
  });

`;
if (!test.includes(testAnchor)) throw new Error("Could not locate frontend automation test anchor");
test = test.replace(testAnchor, groupingTest + testAnchor);
write("src/frontend-automations.test.ts", test);

const changelog = read("CHANGELOG.md");
if (!changelog.startsWith("# Changelog\n\n")) throw new Error("Unexpected CHANGELOG header");
write("CHANGELOG.md", changelog.replace("# Changelog\n\n", `# Changelog\n\n## 0.8.123 - Automation overview grouped by rooms\n\n- Grouped the automation overview by the existing SALTA room assignment.\n- Room groups follow the configured room-management order and only rooms containing automations are shown.\n- Automations without a valid room assignment are collected in a final \`Ohne Raum\` group.\n- Existing automation order inside each room is preserved.\n- Trigger, condition, action and execution behavior are unchanged.\n- Added regression coverage for room ordering, unassigned automations and the grouped layout.\n- No database schema, dependency, mandatory environment-variable, HomeKit pairing or deployment-topology change is required.\n\n`));

write("RELEASE_TEXT.md", `# SALTA v0.8.123\n\nSALTA v0.8.123 makes the automation overview easier to scan by grouping rules by their assigned SALTA room.\n\n## Changes\n\n- Automations are grouped by their existing SALTA room assignment in the automation overview.\n- Room groups follow the order configured in SALTA room management.\n- Only rooms that currently contain automations are displayed.\n- Automations without a valid room assignment are collected in a final \`Ohne Raum\` group.\n- The existing order of automations inside each room is preserved.\n- Existing automation cards, controls and room badges remain available.\n- Trigger, condition, action, schedule and execution behavior are unchanged.\n\n## Root Cause\n\nThe automation data model already stored a \`roomId\`, and SALTA already maintained an explicit room order, but the automation overview rendered every rule into one flat list. With more automations this made rules from different rooms harder to scan even though the required grouping information was already available.\n\nv0.8.123 changes only the overview presentation. It reuses the existing room assignment and room order and does not change automation execution semantics.\n\n## Compatibility\n\n- No database schema change or migration is required.\n- No npm dependency is added or changed.\n- No new mandatory environment variable is introduced.\n- Existing automations require no editing.\n- Existing room assignments remain unchanged.\n- Existing PostgreSQL and SALTA runtime volumes remain compatible.\n- Existing HomeKit pairing state remains compatible.\n- OpenCCU, Shelly, Phoscon, Hue and presence integrations are unchanged.\n\n## Tests\n\n- Regression coverage verifies that room groups follow SALTA room-management order.\n- Regression coverage verifies that automations without a valid room are placed in the final \`Ohne Raum\` group.\n- Regression coverage verifies the compact grouped layout.\n- Release validator, JavaScript syntax checks, TypeScript production build and complete test suite are executed by GitHub Actions before release.\n\n## Production update\n\n\`\`\`bash\ncd /opt/SALTA\ngit pull --ff-only origin main\ndocker compose --env-file .env -f docker-compose.image.yml config\ndocker compose --env-file .env -f docker-compose.image.yml pull\ndocker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans\ndocker compose --env-file .env -f docker-compose.image.yml ps\n\`\`\`\n\nDo not use \`docker compose down -v\` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.\n`);

console.log("Prepared SALTA v0.8.123 automation room grouping changes.");
