# SALTA v0.6.1 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the v0.6.1 package.

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
git commit -m "fix: isolate Phoscon mapping tests from runtime config"
git push origin main
```

## Create and push the release tag

```bash
git tag -a v0.6.1 -m "SALTA v0.6.1"
git push origin v0.6.1
```

## Create the GitHub release

Place `SALTA-v0.6.1.zip` in the repository root or adjust the file path.

```bash
gh release create v0.6.1 \
  --title "SALTA v0.6.1" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.6.1.zip
```
