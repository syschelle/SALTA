# SALTA v0.8.94 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(ui): rename deCONZ settings and add direct link"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'

git show origin/main:public/index.html \
  | grep -F 'data-settings-panel="phoscon" onclick="showSettingsPanel('\''phoscon'\'')">deCONZ</button>'

git show origin/main:public/index.html \
  | grep -F 'id="deconzUiLink"'

git show origin/main:public/index.html \
  | grep -F 'target="_blank" rel="noopener noreferrer" hidden'

git show origin/main:public/app.js \
  | grep -F "if(url.protocol!=='http:'&&url.protocol!=='https:')return undefined"

git show origin/main:public/app.js \
  | grep -F "phosconBaseUrl.addEventListener('input',updateDeconzUiLink)"

git show origin/main:src/frontend-phoscon.test.ts \
  | grep -F 'provides deCONZ connection, pairing and direct UI access settings'

git show origin/main:docker-compose.image.yml \
  | grep -F 'ghcr.io/syschelle/salta:0.8.94'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.94 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.94.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.94 -m "SALTA v0.8.94"
git push origin v0.8.94
```

## GitHub Release

```bash
gh release create v0.8.94 \
  --title "SALTA v0.8.94" \
  --notes-file RELEASE_TEXT.md
```
