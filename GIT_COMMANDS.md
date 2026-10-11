# SALTA v0.8.104 Git commands

## Local quality gate

```bash
npm ci
npm run check
```

Only continue with tagging after the complete `npm run check`, GitHub CI and CodeQL are green.

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(openccu): correct HmIP thermostat mode synchronization"
git push origin main
```

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json | grep -F '"version": "0.8.104"'
git show origin/main:src/openccu-core.ts | grep -F 'return isHomematicIpR4mThermostat(snapshot) ? "SET_POINT_MODE" : "CONTROL_MODE"'
git show origin/main:src/openccu-core.ts | grep -F ': ["SET_POINT_MODE", "CONTROL_MODE", "MODE"]'
git show origin/main:src/openccu-v08104-regression.test.ts | grep -F 'preserves a 20 degree manual target'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.104'
```

Then run the complete quality gate again if the push came from a different checkout:

```bash
npm ci
npm run check
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.104 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.104.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.104 -m "SALTA v0.8.104"
git push origin v0.8.104
```

## GitHub Release

```bash
gh release create v0.8.104 \
  --title "SALTA v0.8.104" \
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
