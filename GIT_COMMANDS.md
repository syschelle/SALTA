# SALTA v0.8.67 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(automations): stabilize heating mode regression tests"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
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
git show origin/main:src/db.ts | grep -F 'CREATE TABLE IF NOT EXISTS automation_system_actions'
git show origin/main:src/automations.ts | grep -F 'CLIMATE_MODE_AUTOMATION_DEVICE_ID'
git show origin/main:public/automation-ui.js | grep -F "climateWinter:'Wintermodus'"
! git show origin/main:public/index.html | grep -F '<span class="system-card-badge">Nur SALTA</span>'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.67 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.67.
```

Wait for GitHub CI and both CodeQL analyses to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.67 -m "SALTA v0.8.67"
git push origin v0.8.67
```

## GitHub Release with gh CLI

```bash
gh release create v0.8.67 \
  --title "SALTA v0.8.67" \
  --notes-file RELEASE_TEXT.md
```
