# SALTA v0.8.49 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(deploy): restore PostgreSQL access with HomeKit host networking"
git push origin main
```

## Verify before tagging

```bash
npm ci
npm run check
```

The validator output must include:

```text
Release validator contract: SALTA v0.8.49 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.49.
```

Wait for GitHub CI and both CodeQL analyses to be completely green on `main`.

## Tag and publish

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.49 -m "SALTA v0.8.49"
git push origin v0.8.49
```

## Production update after the release image is available

```bash
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `down -v` or otherwise delete `salta_postgres_data` / `salta_runtime_data`. No database or HomeKit storage migration is required.
