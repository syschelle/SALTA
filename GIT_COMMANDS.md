# SALTA v0.8.5 – Git and Release Commands

## Verify before committing

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
sh -n install.sh update.sh backup.sh restore.sh
git status
```

## Commit and push main

```bash
git checkout main
git pull --ff-only origin main
git add -A
git commit -m "feat(automations): add realtime Zigbee button events"
git push origin main
```

Wait until the GitHub CI workflow on `main` is green before creating the release tag.

## Tag and publish

```bash
git tag -a v0.8.5 -m "SALTA v0.8.5"
git push origin v0.8.5
```

Optional GitHub CLI release creation from the directory containing the release files:

```bash
gh release create v0.8.5 \
  --title "SALTA v0.8.5" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.8.5.zip \
  ./SALTA-v0.8.5.zip.sha256
```

## Production update

Use the matching image tag in `.env`:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.8.5
```

Then update the production stack:

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
