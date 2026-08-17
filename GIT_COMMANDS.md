# SALTA v0.8.85 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(appearance): apply color profiles immediately"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:public/app.js | grep -F "function applyAppearancePalette(theme,settings=activeAppearanceSettings())"
git show origin/main:public/app.js | grep -F "appearanceProfile.addEventListener('change',()=>applySelectedAppearanceProfile())"
git show origin/main:public/app.js | grep -F "appearanceApplyProfileButton.addEventListener('click',()=>applySelectedAppearanceProfile({announce:true}))"
git show origin/main:public/app.js | grep -F "applyAppearancePalette(normalizeTheme(document.documentElement.dataset.theme),appearancePreviewData)"
git show origin/main:src/frontend-appearance.test.ts | grep -F 'applies a selected profile immediately'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.85'
git show origin/main:src/db.ts | grep -F "notification_state WHERE key='appearance-settings'"
! git show origin/main:src/db.ts | grep -F 'CREATE TABLE IF NOT EXISTS appearance'
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.85 -m "SALTA v0.8.85"
git push origin v0.8.85
```

## GitHub Release

```bash
gh release create v0.8.85 \
  --title "SALTA v0.8.85" \
  --notes-file RELEASE_TEXT.md
```
