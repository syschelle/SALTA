# SALTA v0.8.7 – Git and Release Commands

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
git commit -m "fix(database): persist automation rooms without migrations"
git push origin main
```

Wait until the GitHub CI workflow on `main` is green before creating the release tag.

## Tag and publish

```bash
git tag -a v0.8.7 -m "SALTA v0.8.7"
git push origin v0.8.7
```

## Production update

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.8.7
```

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
