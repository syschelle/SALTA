# SALTA v0.8.102 Git commands

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
git commit -m "fix(climate): enforce manual winter thermostat mode hourly"
git push origin main
```

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json \
  | grep -F '"version": "0.8.102"'

git show origin/main:src/climate-mode.ts \
  | grep -F 'CLIMATE_GUARD_INTERVAL_MS = 60 * 60 * 1000'

git show origin/main:src/climate-mode.ts \
  | grep -F 'const targetMode: "off" | "manual" = mode === "summer" ? "off" : "manual"'

git show origin/main:src/climate-mode.ts \
  | grep -F 'async verifyThermostats'

git show origin/main:src/db.ts \
  | grep -F "UPDATE climate_mode_settings SET winter_mode='manual'"

git show origin/main:public/index.html \
  | grep -F 'Winter setzt alle kompatiblen Thermostate fest auf Handbetrieb'

git show origin/main:src/climate-mode.test.ts \
  | grep -F 'repairs thermostat mode drift to manual while winter mode is active'

git show origin/main:docker-compose.image.yml \
  | grep -F 'ghcr.io/syschelle/salta:0.8.102'
```

Then run the complete local quality gate again if the push came from a different checkout:

```bash
npm ci
npm run check
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.102 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.102.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.102 -m "SALTA v0.8.102"
git push origin v0.8.102
```

## GitHub Release

```bash
gh release create v0.8.102 \
  --title "SALTA v0.8.102" \
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
