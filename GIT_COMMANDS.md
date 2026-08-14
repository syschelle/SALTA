# SALTA v0.8.42 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(climate): add summer thermostat guard and debug notifications"
git push origin main
```

## Verify before release

```bash
npm ci
npm run check
```

The validator output must include:

```text
Release validator contract: SALTA v0.8.42 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.42.
```

Wait for GitHub CI and CodeQL to be completely green before tagging.

## Tag after CI and CodeQL are green

```bash
git tag -a v0.8.42 -m "SALTA v0.8.42"
git push origin v0.8.42
```

## Production update

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Updating from v0.8.41 does not require the legacy HomeKit storage migration.
