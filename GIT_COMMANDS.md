# SALTA v0.8.9 – Git and Release Commands

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
git commit -m "fix(phoscon): harden realtime button events"
git push origin main
```

Wait for a green GitHub CI run before creating the release tag.

## Tag and publish

```bash
git tag -a v0.8.9 -m "SALTA v0.8.9"
git push origin v0.8.9
```

## Production update

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.8.9
```

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
