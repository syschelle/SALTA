# SALTA v0.8.0 – Git and Release Commands

## Verify before committing

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
sh -n install.sh update.sh backup.sh restore.sh
git status
```

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git commit -m "feat(automations): add local device rule engine"
git push origin main
```

Wait until the normal GitHub CI workflow on `main` is green.

## Create and push the release tag

```bash
git tag -a v0.8.0 -m "SALTA v0.8.0"
git push origin v0.8.0
```

## Create the GitHub release

```bash
gh release create v0.8.0 \
  --title "SALTA v0.8.0" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.8.0.zip \
  ./SALTA-v0.8.0.zip.sha256
```

## Production deployment

Use the fixed release image in `.env`:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.8.0
```

Then update the production system:

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
