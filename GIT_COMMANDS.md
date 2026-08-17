# SALTA v0.8.81 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(overview): improve room-group readability"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:public/index.html | grep -F '<section class="section-head overview-section-head"><div><h2>Geräte nach Räumen</h2></div></section>'
! git show origin/main:public/index.html | grep -F 'Shelly-, Zigbee-, Hue-, HomeMatic- und virtuelle Geräte nach Raum.'
git show origin/main:public/styles.css | grep -F '.overview-device-groups .device-room-group{padding:14px 16px 16px'
git show origin/main:public/styles.css | grep -F '.overview-device-groups .device-room-group:nth-child(even){background:linear-gradient(180deg,var(--card) 0,var(--accent-bg) 100%)}'
git show origin/main:src/frontend-device-grouping.test.ts | grep -F 'distinguishes overview room groups with their own background blocks'
git show origin/main:src/db.ts | grep -F 'CREATE TABLE IF NOT EXISTS device_favorites'
git show origin/main:src/openccu-xmlrpc.ts | grep -F 'OPENCCU_CALLBACK_PORT = 18_099'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.81'
git show origin/main:src/db.ts | grep -F "jsonb_build_array('setClimateMode')"
! git show origin/main:src/db.ts | grep -F "ARRAY['setClimateMode']::text[]"
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.81 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.81.
```

Wait for GitHub CI and both CodeQL analyses to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.81 -m "SALTA v0.8.81"
git push origin v0.8.81
```

## GitHub Release with gh CLI

```bash
gh release create v0.8.81 \
  --title "SALTA v0.8.81" \
  --notes-file RELEASE_TEXT.md
```
