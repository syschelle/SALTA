# SALTA v0.8.11 – Git and Release Commands

## Commit and push main

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(automations): add multi-event OR triggers"
git push origin main
```

Wait for the GitHub CI workflow on `main` to be green.

## Tag

```bash
git tag -a v0.8.11 -m "SALTA v0.8.11"
git push origin v0.8.11
```

## Production update

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.8.11
```

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
