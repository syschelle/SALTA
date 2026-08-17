# SALTA v0.8.79 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(overview): add device favorites"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:src/db.ts | grep -F 'CREATE TABLE IF NOT EXISTS device_favorites'
git show origin/main:public/index.html | grep -F 'id="overviewFavoritesSection"'
git show origin/main:public/index.html | grep -F 'id="deviceFavorite"'
git show origin/main:public/app.js | grep -F "deviceCard(device,false,'favorite')"
git show origin/main:src/configuration-backup.ts | grep -F 'device_favorites: backupRows().optional()'
git show origin/main:src/openccu-core.ts | grep -F 'snapshot.channelType.trim().toUpperCase() === "KEY"'
git show origin/main:src/openccu-xmlrpc.ts | grep -F 'OPENCCU_CALLBACK_PORT = 18_099'
git show origin/main:src/openccu-xmlrpc.ts | grep -F '"BidCos-RF": 2001'
git show origin/main:src/openccu-adapter.ts | grep -F 'openCcuButtonEventValue(event.parameter)'
git show origin/main:src/openccu-adapter.ts | grep -F 'key: "buttonEvent"'
git show origin/main:public/automation-ui.js | grep -F "'hm-pb-6-wm55':[1002,1001,1003]"
git show origin/main:docker-compose.image.yml | sha256sum
git show origin/main:migrate-homekit-storage.sh | sha256sum

git show origin/main:src/main.ts | grep -F 'new HueAdapter(registry)'
git show origin/main:src/server.ts | grep -F '/api/settings/hue/pair'
git show origin/main:src/hue-adapter.ts | grep -F '/eventstream/clip/v2'
git show origin/main:src/hue-mdns.ts | grep -F '_hue._tcp.local'
git show origin/main:src/hue-tls.ts | grep -F 'rejectUnauthorized: true'
git show origin/main:src/hue-tls.ts | grep -F 'HUE_LOCAL_NETWORK_REQUIRED'
git show origin/main:public/index.html | grep -F 'Philips Hue'
git show origin/main:public/index.html | grep -F 'option value="time"'
git show origin/main:src/db.ts | grep -F 'CREATE TABLE IF NOT EXISTS automation_time_triggers'
git show origin/main:src/main.ts | grep -F 'timeZone: config.TZ'
git show origin/main:src/db.ts | grep -F 'CREATE TABLE IF NOT EXISTS automation_conditions'
git show origin/main:src/automations.ts | grep -F 'automationRuleConditions'
git show origin/main:public/index.html | grep -F 'Weitere UND-Bedingung hinzufügen'
git show origin/main:src/db.ts | grep -F 'CREATE TABLE IF NOT EXISTS automation_system_actions'
git show origin/main:src/db.ts | grep -F "jsonb_build_array('setClimateMode')"
! git show origin/main:src/db.ts | grep -F "ARRAY['setClimateMode']::text[]"
git show origin/main:src/automations.ts | grep -F 'CLIMATE_MODE_AUTOMATION_DEVICE_ID'
git show origin/main:public/automation-ui.js | grep -F "climateWinter:'Wintermodus'"
! git show origin/main:public/index.html | grep -F '<span class="system-card-badge">Nur SALTA</span>'
git show origin/main:public/index.html | grep -F '<h2>Urlaubsmodus</h2>'
git show origin/main:src/server.ts | grep -F '/api/system/vacation-mode'
git show origin/main:src/main.ts | grep -F 'new VacationModeManager(registry, config.TZ)'
git show origin/main:src/vacation-mode.ts | grep -F 'VACATION_CONTACT_ALERT_SENT'
git show origin/main:public/automation-ui.js | grep -F "vacationActive:['Aktiv','Inaktiv']"
git show origin/main:public/index.html | grep -F 'aria-label="Hausstatus"'
git show origin/main:public/styles.css | grep -F '.overview-system-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))'
git show origin/main:src/db.ts | grep -F 'CREATE TABLE IF NOT EXISTS presence_target_profiles'
git show origin/main:public/index.html | grep -F 'id="presenceTargetPersonName"'
git show origin/main:src/fritzbox-presence.ts | grep -F 'presentNames:JSON.stringify(presentNames)'
git show origin/main:public/app.js | grep -F 'presentNames.length?compactPresenceNames(presentNames)'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.79 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.79.
```

Wait for GitHub CI and both CodeQL analyses to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.79 -m "SALTA v0.8.79"
git push origin v0.8.79
```

## GitHub Release with gh CLI

```bash
gh release create v0.8.79 \
  --title "SALTA v0.8.79" \
  --notes-file RELEASE_TEXT.md
```
