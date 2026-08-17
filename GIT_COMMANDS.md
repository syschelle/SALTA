# SALTA v0.8.84 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "test(frontend): align appearance regression coverage"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:src/frontend-auth.test.ts | grep -F "await loadAppearanceSettings().catch(()=>undefined);navigate();load()"
git show origin/main:src/frontend-device-grouping.test.ts | grep -F 'background:var(--overview-room-bg)'
git show origin/main:src/frontend-device-grouping.test.ts | grep -F -- '--overview-room-bg:#eef2ff'
git show origin/main:public/index.html | grep -F 'data-settings-panel="appearance"'
git show origin/main:public/index.html | grep -F 'id="appearanceLightColors"'
git show origin/main:public/index.html | grep -F 'id="appearanceDarkColors"'
git show origin/main:public/app.js | grep -F 'const APPEARANCE_PROFILES='
git show origin/main:public/app.js | grep -F "['roomBackground','Raumabgrenzung','--overview-room-bg']"
git show origin/main:public/styles.css | grep -F 'background:var(--overview-room-bg)'
git show origin/main:src/server.ts | grep -F '/api/settings/appearance'
git show origin/main:src/db.ts | grep -F "notification_state WHERE key='appearance-settings'"
! git show origin/main:src/db.ts | grep -F 'CREATE TABLE IF NOT EXISTS appearance'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.83'
git show origin/main:src/db.ts | grep -F "jsonb_build_array('setClimateMode')"
! git show origin/main:src/db.ts | grep -F "ARRAY['setClimateMode']::text[]"
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.84 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.84.
```

Wait for GitHub CI and both CodeQL analyses to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.84 -m "SALTA v0.8.84"
git push origin v0.8.84
```

## GitHub Release

```bash
gh release create v0.8.84 \
  --title "SALTA v0.8.84" \
  --notes-file RELEASE_TEXT.md
```
