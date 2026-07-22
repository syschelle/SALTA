# SALTA v0.5.4 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the v0.5.4 package.

## Validate

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
sh -n install.sh update.sh backup.sh restore.sh
docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.image.yml config >/dev/null
```

## Commit and push

```bash
git checkout main
git pull --ff-only origin main
git status
git add -A
git commit -m "docs: correct SALTA security guidance for v0.5.4"
git push origin main
```

## Tag and publish the container

```bash
git tag -a v0.5.4 -m "SALTA v0.5.4"
git push origin v0.5.4
```

## Create the GitHub release

Place `SALTA-v0.5.4.zip` in the repository root or adjust the file path.

```bash
gh release create v0.5.4 \
  --title "SALTA v0.5.4" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.5.4.zip
```
