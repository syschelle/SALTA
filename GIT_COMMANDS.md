# SALTA v0.8.86 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(i18n): add German and English UI localization"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:public/index.html | grep -F 'id="languageSelector"'
git show origin/main:public/index.html | grep -F 'id="appearanceLanguage"'
git show origin/main:public/login.html | grep -F 'id="loginLanguage"'
git show origin/main:public/index.html | grep -F '<script src="/i18n.js"></script>'
git show origin/main:public/i18n.js | grep -F "const COOKIE='salta_language'"
git show origin/main:public/i18n.js | grep -F "new Set(['auto','de','en'])"
git show origin/main:public/i18n/en.json | grep -F '"Übersicht": "Overview"'
git show origin/main:public/i18n/en.json | grep -F '"Geräte nach Räumen": "Devices by room"'
git show origin/main:src/server.ts | grep -F '["/i18n/en.json", "i18n/en.json"]'
git show origin/main:src/frontend-i18n.test.ts | grep -F 'browser-localized SALTA UI'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.86'
git show origin/main:src/db.ts | grep -F "jsonb_build_array('setClimateMode')"
! git show origin/main:src/db.ts | grep -F "ARRAY['setClimateMode']::text[]"
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.86 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.86.
```

Wait for GitHub CI and both CodeQL analyses to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.86 -m "SALTA v0.8.86"
git push origin v0.8.86
```

## GitHub Release

```bash
gh release create v0.8.86 \
  --title "SALTA v0.8.86" \
  --notes-file RELEASE_TEXT.md
```
