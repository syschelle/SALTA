# SALTA v0.8.2 – Git and Release Commands

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
git status
git commit -m "fix(ci): make Vitest bootstrap self-contained"
git push origin main
```

Wait until the normal GitHub CI workflow on `main` is green.

## Create and push the release tag

```bash
git tag -a v0.8.2 -m "SALTA v0.8.2"
git push origin v0.8.2
```

## Create the GitHub release

Run this from the directory containing the release artifacts:

```bash
gh release create v0.8.2 \
  --title "SALTA v0.8.2" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.8.2.zip \
  ./SALTA-v0.8.2.zip.sha256
```

## Production deployment

Use the fixed release image in `.env`:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.8.2
```

Then update the production system:

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
