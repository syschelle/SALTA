# SALTA v0.4.21 – Git and Release Commands

```bash
git checkout main
git pull --ff-only origin main

npm ci
npm run check
node --check public/app.js
sh -n deploy.sh update.sh backup.sh restore.sh

git add .
git commit -m "release: SALTA v0.4.21"
git push origin main

git tag -a v0.4.21 -m "SALTA v0.4.21"
git push origin v0.4.21
```

```bash
gh release create v0.4.21 \
  --title "SALTA v0.4.21" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.4.21.zip
```
