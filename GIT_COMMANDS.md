# SALTA v0.8.3 – Git and Release Commands

## Verify before committing

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
sh -n install.sh update.sh backup.sh restore.sh
git status
```

## Commit and push to main

```bash
git checkout main
git pull --ff-only origin main
git add -A
git commit -m "feat(automations): add searchable device selectors"
git push origin main
```

Wait until the normal CI workflow on `main` completes successfully before creating the release tag.

## Create and push the release tag

```bash
git tag -a v0.8.3 -m "SALTA v0.8.3"
git push origin v0.8.3
```

## Optional GitHub CLI release

```bash
gh release create v0.8.3 \
  --title "SALTA v0.8.3" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.8.3.zip \
  ./SALTA-v0.8.3.zip.sha256
```

## Production update

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.8.3
```

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
