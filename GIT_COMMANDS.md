# SALTA v0.8.90 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(i18n): complete dynamic English translations"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:public/i18n/en.json | grep -F '"DEBUG aktiv": "DEBUG enabled"'
git show origin/main:public/i18n/en.json | grep -F '"Gerätetyp": "Device type"'
git show origin/main:public/i18n/en.json | grep -F '"DIAGNOSE & FEHLERSUCHE": "DIAGNOSTICS & TROUBLESHOOTING"'
git show origin/main:public/app.js | grep -F 'new Date(report.completedAt).toLocaleString(appLocale())'
git show origin/main:public/app.js | grep -F 'new Date(gateway.lastSync).toLocaleString(appLocale())'
! git show origin/main:public/app.js | grep -F '.toLocaleString()'
git show origin/main:src/frontend-i18n.test.ts | grep -F 'covers dynamic status, credential, diagnostics and device-info text in English'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.90'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.90 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.90.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.90 -m "SALTA v0.8.90"
git push origin v0.8.90
```

## GitHub Release

```bash
gh release create v0.8.90 \
  --title "SALTA v0.8.90" \
  --notes-file RELEASE_TEXT.md
```
