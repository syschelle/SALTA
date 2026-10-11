# SALTA v0.8.112 Git commands

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
git commit -m "fix(openccu): preserve manual mode during thermostat setbacks"
git push origin main
```

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json | grep -F '"version": "0.8.112"'
git show origin/main:src/openccu-core.ts | grep -F 'export function openCcuTargetTemperaturePlan('
git show origin/main:src/openccu-core.ts | grep -F 'manualModeParameter && (currentMode === "manual" || currentMode === "off")'
git show origin/main:src/openccu-adapter.ts | grep -F 'openCcuTargetTemperaturePlan(metadata, device.state, command.value)'
git show origin/main:src/openccu-v08112-regression.test.ts | grep -F 'keeps a classic HomeMatic thermostat in manual mode while applying night setback'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.112'
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.112 -m "SALTA v0.8.112"
git push origin v0.8.112
```

## GitHub Release

```bash
gh release create v0.8.112 \
  --title "SALTA v0.8.112" \
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

Do not use `docker compose down -v`.
