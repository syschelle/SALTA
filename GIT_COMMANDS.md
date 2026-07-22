# SALTA v0.4.33 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the v0.4.33 package.

## Validate, commit and push

```bash
git checkout main
git pull --ff-only origin main

npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check

node --check public/app.js
node --check public/login.js
node --check public/theme-init.js
sh -n deploy.sh update.sh backup.sh restore.sh

git add .
git commit -m "release: SALTA v0.4.33"
git push origin main
```

## Create and push the release tag

```bash
git tag -a v0.4.33 -m "SALTA v0.4.33"
git push origin v0.4.33
```

## Create the GitHub release

Place `SALTA-v0.4.33.zip` in the repository root or adjust the file path in the command.

```bash
gh release create v0.4.33 \
  --title "SALTA v0.4.33" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.4.33.zip
```
