# SALTA v0.8.15 – Git and Release Commands

## Commit and push main

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(presence): improve FRITZ!Box connection status and layout"
git push origin main
```

Wait for the GitHub CI workflow on `main` to be green.

## Tag

```bash
git tag -a v0.8.15 -m "SALTA v0.8.15"
git push origin v0.8.15
```

## Production update

If `.env` pins a versioned image, set:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.8.15
```

Then update the deployment:

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
