# SALTA v0.8.51 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(deploy): simplify HomeKit and PostgreSQL networking"
git push origin main
```

## Verify before tagging

```bash
npm ci
npm run check
```

The validator output must include:

```text
Release validator contract: SALTA v0.8.51 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.51.
```

Wait for GitHub CI and both CodeQL analyses to be completely green on `main`.

## Tag and publish

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.51 -m "SALTA v0.8.51"
git push origin v0.8.51
```

## Production update after the release image is available

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `down -v` or otherwise delete `salta_postgres_data` / `salta_runtime_data`.

## Legacy HomeKit migration path

Only installations paired with HomeKit before v0.8.41 need this one-time step, before recreating the old container:

```bash
cd /opt/SALTA
./migrate-homekit-storage.sh
```

Host script path: `/opt/SALTA/migrate-homekit-storage.sh`  
Legacy source inside old container: `/app/persist`  
Persistent HomeKit target: `/var/lib/salta/homekit` in `salta_runtime_data`
