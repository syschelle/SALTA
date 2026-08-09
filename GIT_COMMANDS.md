# SALTA v0.7.18 – Git and Release Commands

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
git commit -m "feat(shelly): add device web interface shortcut"
git push origin main
```

Wait for the CI workflow on `main` to complete successfully before creating the release tag.

## Tag and publish

```bash
git tag -a v0.7.18 -m "SALTA v0.7.18"
git push origin v0.7.18
```

## GitHub release

```bash
gh release create v0.7.18 \
  --title "SALTA v0.7.18" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.7.18.zip \
  ./SALTA-v0.7.18.zip.sha256
```

## Production update

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.7.18
```

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
