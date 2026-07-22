# SALTA v0.5.6 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the v0.5.6 package.

## Validate

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
sh -n install.sh update.sh backup.sh restore.sh
docker compose --env-file .env.example -f docker-compose.image.yml config >/dev/null
```

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git status
git add -A
git commit -m "fix: make image Compose deployment standalone for SALTA v0.5.6"
git push origin main
```

## Create and push the release tag

```bash
git tag -a v0.5.6 -m "SALTA v0.5.6"
git push origin v0.5.6
```

## Create the GitHub release

Place `SALTA-v0.5.6.zip` in the repository root or adjust the file path.

```bash
gh release create v0.5.6 \
  --title "SALTA v0.5.6" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.5.6.zip
```
