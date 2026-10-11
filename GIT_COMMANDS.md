# SALTA v0.8.106 Git commands

## Local quality gate

```bash
npm ci
npm run check
```

Only continue after the complete `npm run check` is green.

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(homekit): add Winter mode switch"
git push origin main
```

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json | grep -F '"version": "0.8.106"'
git show origin/main:src/homekit.ts | grep -F 'return Boolean(value) ? "winter" : "summer"'
git show origin/main:src/homekit.ts | grep -F 'this.systemActions.applyClimateMode(climateMode)'
git show origin/main:src/climate-mode.ts | grep -F 'winterActive: settings.mode === "winter", on: settings.mode === "winter"'
git show origin/main:src/db.ts | grep -F "VALUES('system:climate-mode',true,'Wintermodus',false,NULL)"
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.106'
```

Then run the complete quality gate again if the push came from a different checkout:

```bash
npm ci
npm run check
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.106 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.106.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.106 -m "SALTA v0.8.106"
git push origin v0.8.106
```

## GitHub Release

```bash
gh release create v0.8.106 \
  --title "SALTA v0.8.106" \
  --notes-file RELEASE_TEXT.md
```

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Never use `docker compose down -v`; keep the existing PostgreSQL and SALTA runtime volumes.
