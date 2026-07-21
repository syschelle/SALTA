# SALTA v0.4.18 – Git and Release Commands

```bash
git checkout main
git pull --ff-only origin main

npm ci
npm run check
node --check public/app.js

git add .
git commit -m "release: SALTA v0.4.18"
git push origin main

git tag -a v0.4.18 -m "SALTA v0.4.18"
git push origin v0.4.18
```

Create the GitHub release:

```bash
gh release create v0.4.18 \
  --title "SALTA v0.4.18" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.4.18.zip
```
