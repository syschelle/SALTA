# SALTA v0.4.32 – Git and Release Commands

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
git commit -m "release: SALTA v0.4.32"
git push origin main

git tag -a v0.4.32 -m "SALTA v0.4.32"
git push origin v0.4.32
```

```bash
gh release create v0.4.32 \
  --title "SALTA v0.4.32" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.4.32.zip
```
