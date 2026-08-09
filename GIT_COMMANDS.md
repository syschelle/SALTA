# SALTA v0.7.16 – Git and Release Commands

## Verify before commit

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
sh -n install.sh update.sh backup.sh restore.sh
```

## Commit and push

```bash
git checkout main
git pull --ff-only origin main
git status
git add -A
git commit -m "feat(virtual): add HomeKit virtual switches"
git push origin main
```

Wait for the CI workflow on `main` to complete successfully before creating the release tag.

## Tag and publish

```bash
git tag -a v0.7.16 -m "SALTA v0.7.16"
git push origin v0.7.16
```

## GitHub release

```bash
gh release create v0.7.16 \
  --title "SALTA v0.7.16" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.7.16.zip \
  ./SALTA-v0.7.16.zip.sha256
```

## Production update

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.7.16
```

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
