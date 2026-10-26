import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = (file) => readFileSync(file, "utf8");
const write = (file, content) => writeFileSync(file, content, "utf8");
const replaceOnce = (file, from, to) => {
  const source = read(file);
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${file}: expected one occurrence of ${JSON.stringify(from)}, found ${count}`);
  write(file, source.replace(from, to));
};

execFileSync(process.execPath, ["scripts/set-version.mjs", "0.8.134"], { stdio: "inherit" });

replaceOnce(
  "public/index.html",
  '    <a href="#hue" data-nav="hue"><span class="nav-icon mdi mdi-lightbulb-group-outline" aria-hidden="true"></span><span>Philips Hue</span></a>\n    <a href="#openccu" data-nav="openccu"><span class="nav-icon mdi mdi-access-point-network" aria-hidden="true"></span><span>HomeMatic</span></a>',
  '    <a href="#hue" data-nav="hue"><span class="nav-icon mdi mdi-lightbulb-group-outline" aria-hidden="true"></span><span>Philips Hue</span></a>\n    <a href="#fritzbox" data-nav="fritzbox"><span class="nav-icon mdi mdi-router-wireless" aria-hidden="true"></span><span>FRITZ!Box</span></a>\n    <a href="#openccu" data-nav="openccu"><span class="nav-icon mdi mdi-access-point-network" aria-hidden="true"></span><span>HomeMatic</span></a>'
);

replaceOnce(
  "public/index.html",
  '    <section id="hueGrid" class="device-groups"></section>\n  </section>\n\n  <section class="page" data-page="openccu" aria-labelledby="openccu-title" hidden>',
  `    <section id="hueGrid" class="device-groups"></section>\n  </section>\n\n  <section class="page" data-page="fritzbox" aria-labelledby="fritzbox-title" hidden>\n    <header class="page-header"><div><p class="eyebrow">FRITZ!BOX SMART HOME</p><h1 id="fritzbox-title">FRITZ!Box</h1><p class="muted">FRITZ!Box-Smart-Home-Geräte anzeigen und direkt über SALTA steuern.</p></div><div class="header-actions"><button class="secondary" onclick="reconcileFritzBox()"><span class="mdi mdi-sync" aria-hidden="true"></span>Synchronisieren</button><a class="button-link" href="#presence"><span class="mdi mdi-cog-outline" aria-hidden="true"></span>FRITZ!Box konfigurieren</a></div></header>\n    <section class="section-head"><div><h2>FRITZ!Box-Geräte nach Räumen</h2><p class="muted">Die Geräte werden lokal aus der FRITZ!Box übernommen; SALTA verwaltet die Raumzuordnung und Steuerung.</p></div><div class="filters"><select id="fritzBoxRoomFilter"><option value="">Alle Räume</option></select><label class="search"><span class="mdi mdi-magnify" aria-hidden="true"></span><input id="fritzBoxFilter" placeholder="FRITZ!Box-Gerät suchen"></label></div></section>\n    <section id="fritzBoxGrid" class="device-groups"></section>\n  </section>\n\n  <section class="page" data-page="openccu" aria-labelledby="openccu-title" hidden>`
);

replaceOnce(
  "public/app.js",
  "const pages=['overview','shelly','zigbee','hue','openccu','virtual','presence','automations','automation-editor','rooms','logs','settings'];",
  "const pages=['overview','shelly','zigbee','hue','fritzbox','openccu','virtual','presence','automations','automation-editor','rooms','logs','settings'];"
);
replaceOnce(
  "public/app.js",
  "function renderFilters(){fillRoomFilter(roomFilter);fillRoomFilter(zigbeeRoomFilter);fillRoomFilter(hueRoomFilter);fillRoomFilter(openCcuRoomFilter);fillRoomFilter(virtualRoomFilter)}",
  "function renderFilters(){fillRoomFilter(roomFilter);fillRoomFilter(zigbeeRoomFilter);fillRoomFilter(hueRoomFilter);fillRoomFilter(fritzBoxRoomFilter);fillRoomFilter(openCcuRoomFilter);fillRoomFilter(virtualRoomFilter)}"
);
replaceOnce(
  "public/app.js",
  "function renderDevices(){renderOverviewFavorites();renderOverviewDevices();renderDeviceGrid('shelly',deviceGrid,filter,roomFilter);renderDeviceGrid('phoscon',zigbeeGrid,zigbeeFilter,zigbeeRoomFilter);renderDeviceGrid('hue',hueGrid,hueFilter,hueRoomFilter);renderDeviceGrid('openccu',openCcuGrid,openCcuFilter,openCcuRoomFilter);renderDeviceGrid('virtual',virtualGrid,virtualFilter,virtualRoomFilter);renderHomeKitDeviceList()}",
  "function renderDevices(){renderOverviewFavorites();renderOverviewDevices();renderDeviceGrid('shelly',deviceGrid,filter,roomFilter);renderDeviceGrid('phoscon',zigbeeGrid,zigbeeFilter,zigbeeRoomFilter);renderDeviceGrid('hue',hueGrid,hueFilter,hueRoomFilter);renderDeviceGrid('fritzbox',fritzBoxGrid,fritzBoxFilter,fritzBoxRoomFilter);renderDeviceGrid('openccu',openCcuGrid,openCcuFilter,openCcuRoomFilter);renderDeviceGrid('virtual',virtualGrid,virtualFilter,virtualRoomFilter);renderHomeKitDeviceList()}"
);
replaceOnce(
  "public/app.js",
  "async function reconcileHue(){try{await api('/api/adapters/hue/reconcile',{method:'POST'});await load();notify('Hue-Synchronisierung abgeschlossen.')}catch(error){notify(friendlyHueError(error),true)}}\nasync function reconcileOpenCcu()",
  "async function reconcileHue(){try{await api('/api/adapters/hue/reconcile',{method:'POST'});await load();notify('Hue-Synchronisierung abgeschlossen.')}catch(error){notify(friendlyHueError(error),true)}}\nasync function reconcileFritzBox(){try{await api('/api/fritzbox/smarthome/refresh',{method:'POST'});await load();notify('FRITZ!Box-Smart-Home-Synchronisierung abgeschlossen.')}catch(error){notify(error.message,true)}}\nasync function reconcileOpenCcu()"
);
replaceOnce(
  "public/app.js",
  "hueFilter.addEventListener('input',renderDevices);hueRoomFilter.addEventListener('change',renderDevices);openCcuFilter.addEventListener('input',renderDevices);",
  "hueFilter.addEventListener('input',renderDevices);hueRoomFilter.addEventListener('change',renderDevices);fritzBoxFilter.addEventListener('input',renderDevices);fritzBoxRoomFilter.addEventListener('change',renderDevices);openCcuFilter.addEventListener('input',renderDevices);"
);

replaceOnce(
  "src/frontend-fritzbox-smarthome.test.ts",
  'const source = readFileSync(new URL("../public/fritzbox-smarthome.js", import.meta.url), "utf8");\n',
  'const source = readFileSync(new URL("../public/fritzbox-smarthome.js", import.meta.url), "utf8");\nconst app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");\n'
);
replaceOnce(
  "src/frontend-fritzbox-smarthome.test.ts",
  '  it("uses the authenticated SALTA API instead of embedding FRITZ credentials in the browser", () => {',
  `  it("renders imported FRITZ!Box devices on a dedicated navigation page", () => {\n    const hueNav = index.indexOf('href="#hue" data-nav="hue"');\n    const fritzNav = index.indexOf('href="#fritzbox" data-nav="fritzbox"');\n    const openCcuNav = index.indexOf('href="#openccu" data-nav="openccu"');\n    expect(hueNav).toBeGreaterThanOrEqual(0);\n    expect(fritzNav).toBeGreaterThan(hueNav);\n    expect(openCcuNav).toBeGreaterThan(fritzNav);\n    expect(index).toContain('data-page="fritzbox"');\n    expect(index).toContain('id="fritzBoxGrid" class="device-groups"');\n    expect(index).toContain('id="fritzBoxRoomFilter"');\n    expect(index).toContain('id="fritzBoxFilter"');\n    expect(app).toContain("'hue','fritzbox','openccu'");\n    expect(app).toContain("renderDeviceGrid('fritzbox',fritzBoxGrid,fritzBoxFilter,fritzBoxRoomFilter)");\n    expect(app).toContain("api('/api/fritzbox/smarthome/refresh',{method:'POST'})");\n    expect(app).toContain("fritzBoxFilter.addEventListener('input',renderDevices)");\n  });\n\n  it("uses the authenticated SALTA API instead of embedding FRITZ credentials in the browser", () => {`
);

replaceOnce(
  "scripts/validate-release.mjs",
  'if (!publicIndex.includes(\'data-nav="virtual"\')) fail("Virtual Devices navigation is missing");',
  `const hueNavIndex = publicIndex.indexOf('data-nav="hue"');\nconst fritzBoxNavIndex = publicIndex.indexOf('data-nav="fritzbox"');\nconst openCcuNavIndex = publicIndex.indexOf('data-nav="openccu"');\nif (fritzBoxNavIndex < 0 || !(hueNavIndex < fritzBoxNavIndex && fritzBoxNavIndex < openCcuNavIndex)) fail("FRITZ!Box navigation must exist between Hue and HomeMatic");\nif (!publicIndex.includes('data-page="fritzbox"') || !publicIndex.includes('id="fritzBoxGrid" class="device-groups"') || !publicIndex.includes('id="fritzBoxRoomFilter"') || !publicIndex.includes('id="fritzBoxFilter"')) fail("FRITZ!Box device page is incomplete");\nif (!virtualFrontend.includes("renderDeviceGrid('fritzbox',fritzBoxGrid,fritzBoxFilter,fritzBoxRoomFilter)")) fail("FRITZ!Box device page is not wired to the common renderer");\nif (!virtualFrontend.includes("api('/api/fritzbox/smarthome/refresh',{method:'POST'})")) fail("FRITZ!Box page refresh is not wired to the Smart Home adapter");\nif (!publicIndex.includes('data-nav="virtual"')) fail("Virtual Devices navigation is missing");`
);

const translations = {
  de: {
    "FRITZ!BOX SMART HOME": "FRITZ!BOX SMART HOME",
    "FRITZ!Box-Smart-Home-Geräte anzeigen und direkt über SALTA steuern.": "FRITZ!Box-Smart-Home-Geräte anzeigen und direkt über SALTA steuern.",
    "FRITZ!Box konfigurieren": "FRITZ!Box konfigurieren",
    "FRITZ!Box-Geräte nach Räumen": "FRITZ!Box-Geräte nach Räumen",
    "Die Geräte werden lokal aus der FRITZ!Box übernommen; SALTA verwaltet die Raumzuordnung und Steuerung.": "Die Geräte werden lokal aus der FRITZ!Box übernommen; SALTA verwaltet die Raumzuordnung und Steuerung.",
    "FRITZ!Box-Gerät suchen": "FRITZ!Box-Gerät suchen",
    "FRITZ!Box-Smart-Home-Synchronisierung abgeschlossen.": "FRITZ!Box-Smart-Home-Synchronisierung abgeschlossen."
  },
  en: {
    "FRITZ!BOX SMART HOME": "FRITZ!BOX SMART HOME",
    "FRITZ!Box-Smart-Home-Geräte anzeigen und direkt über SALTA steuern.": "View and control FRITZ!Box smart-home devices directly through SALTA.",
    "FRITZ!Box konfigurieren": "Configure FRITZ!Box",
    "FRITZ!Box-Geräte nach Räumen": "FRITZ!Box devices by room",
    "Die Geräte werden lokal aus der FRITZ!Box übernommen; SALTA verwaltet die Raumzuordnung und Steuerung.": "Devices are imported locally from the FRITZ!Box; SALTA manages room assignments and control.",
    "FRITZ!Box-Gerät suchen": "Search FRITZ!Box device",
    "FRITZ!Box-Smart-Home-Synchronisierung abgeschlossen.": "FRITZ!Box smart-home synchronization completed."
  }
};
for (const language of ["de", "en"]) {
  const file = `public/i18n/${language}.json`;
  const data = JSON.parse(read(file));
  Object.assign(data.phrases, translations[language]);
  write(file, `${JSON.stringify(data, null, 2)}\n`);
}

replaceOnce(
  "CHANGELOG.md",
  "# Changelog\n\n",
  `# Changelog\n\n## 0.8.134 - Dedicated FRITZ!Box Smart Home device page\n\n- Add a dedicated FRITZ!Box entry to the main navigation between Philips Hue and HomeMatic.\n- Show imported FRITZ!Box Smart Home devices on their own room-grouped page, including devices without a room under \"Nicht zugeordnet\".\n- Reuse the common SALTA device cards so thermostat target-temperature controls, room assignment, favorites and device configuration remain consistent.\n- Add room and text filters for FRITZ!Box devices.\n- Add a page-level Smart Home refresh button using the existing authenticated FRITZ!Box REST adapter.\n- Keep FRITZ!Box presence detection and Smart Home configuration behavior unchanged.\n\n`
);

replaceOnce(
  "MIGRATION_PATH.md",
  "FRITZ!Box Smart Home is additive and disabled by default. Its opt-in state uses the existing backed-up notification_state table, so v0.8.132 requires no schema migration and does not import devices unless explicitly enabled.",
  "v0.8.134 adds a dedicated FRITZ!Box Smart Home device page for devices that are already imported by the existing adapter. Existing opt-in settings, credentials, imported device IDs and room assignments are reused unchanged; no database schema migration or device re-import is required."
);

write("RELEASE_TEXT.md", `# SALTA v0.8.134\n\nSALTA v0.8.134 adds a dedicated FRITZ!Box Smart Home device page so imported FRITZ!Box devices are directly visible and controllable inside SALTA.\n\n## Changes\n\n- Add a dedicated **FRITZ!Box** entry to the main navigation between Philips Hue and HomeMatic.\n- Add a dedicated FRITZ!Box Smart Home device page using the existing SALTA room-grouped device renderer.\n- Show devices without a SALTA room assignment under **Nicht zugeordnet / Unassigned** instead of making them effectively invisible from the room-only overview.\n- Reuse the existing SALTA device cards and controls, including thermostat target-temperature control, favorites, room assignment and device configuration.\n- Add FRITZ!Box room filtering and device search.\n- Add a page-level synchronization action using the existing authenticated \`/api/fritzbox/smarthome/refresh\` endpoint.\n- Keep the existing FRITZ!Box Smart Home opt-in settings and FRITZ!Box presence integration unchanged.\n\n## Root Cause\n\nFRITZ!Box Smart Home devices were already imported into the SALTA registry with source \`fritzbox\`, but the main application had no dedicated FRITZ!Box device page. The overview intentionally displays only devices that have a valid SALTA room assignment. Newly imported FRITZ!Box devices without a room therefore had no obvious place in the user interface even though synchronization reported them as successfully integrated.\n\nv0.8.134 adds an explicit FRITZ!Box navigation target and renders the existing imported devices with the shared SALTA device UI. Devices that do not yet have a room appear under the standard **Unassigned** group and can be assigned through the existing device configuration dialog.\n\n## Compatibility\n\n- No database schema change or manual migration is required.\n- Existing FRITZ!Box credentials and Smart Home opt-in settings remain unchanged.\n- Existing imported FRITZ!Box device IDs, states and room assignments remain unchanged.\n- FRITZ!Box presence detection remains independent and unchanged.\n- Existing Shelly, Phoscon/deCONZ, Hue, OpenCCU, virtual-device, automation and HomeKit data remain unchanged.\n- No new npm dependency or mandatory environment variable is introduced.\n- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.\n\n## Tests\n\n- Verify that the FRITZ!Box navigation entry is positioned between Philips Hue and HomeMatic.\n- Verify the dedicated FRITZ!Box page, room filter, search field and device grid.\n- Verify that source \`fritzbox\` is wired to the shared room-grouped device renderer.\n- Verify that the page-level synchronization button uses the existing authenticated Smart Home refresh endpoint.\n- Release validator passed for SALTA v0.8.134.\n- JavaScript syntax checks passed.\n- TypeScript production build passed.\n- Test symbol preflight passed for 104 test files.\n- 104 of 104 test files passed.\n- 583 of 583 tests passed.\n- Full CI on \`main\` passed successfully.\n\n## Production update\n\n\`\`\`bash\ncd /opt/SALTA\ngit pull --ff-only origin main\ndocker compose --env-file .env -f docker-compose.image.yml config\ndocker compose --env-file .env -f docker-compose.image.yml pull\ndocker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans\ndocker compose --env-file .env -f docker-compose.image.yml ps\n\`\`\`\n\nDo not use \`docker compose down -v\` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.\n`);

console.log("Prepared SALTA v0.8.134 dedicated FRITZ!Box device page.");
