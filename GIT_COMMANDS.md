# SALTA v0.8.26 – Git and Release Commands

## Commit and push main

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(ui): consolidate layouts and enrich device details"
git push origin main
```

Wait for the GitHub CI and CodeQL workflows on `main` to be green.

## Tag

```bash
git tag -a v0.8.26 -m "SALTA v0.8.26"
git push origin v0.8.26
```

## Production update

If `.env` pins a versioned image, set:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.8.26
```

Then update the deployment:

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
