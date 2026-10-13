# SALTA v0.8.126

SALTA v0.8.126 visually separates automation names in the System Log by using the same shared accent color as the `DIAGNOSE & FEHLERSUCHE` label.

## Changes

- Automation names appended to System Log topics are now rendered as a dedicated element.
- Only the automation name uses SALTA's shared `var(--accent)` color; the message text, separator and technical log code keep their existing appearance.
- The automation-name color therefore follows SALTA light/dark mode and configured appearance profiles automatically.
- Existing automation names continue to come from the already stored `details.automationName` diagnostic field.
- Automation execution, log persistence, filtering, repeat aggregation and diagnostic export are unchanged.

## Root Cause

v0.8.125 made the automation name visible directly in the System Log topic, but it was rendered inside the same escaped text node as the generic log message. This made the name readable without opening Details, but it could not be styled independently.

v0.8.126 renders only the automation name in a dedicated span and assigns the existing shared accent token used by the System Log's `DIAGNOSE & FEHLERSUCHE` eyebrow. No new hard-coded color is introduced.

## Compatibility

- No database schema change or migration is required.
- Existing system-log rows remain compatible.
- Existing automation definitions require no editing.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.
- OpenCCU, Shelly, Phoscon, Hue and presence integrations are unchanged.

## Tests

- Regression coverage verifies dedicated automation-name topic markup.
- Regression coverage verifies that the automation-name style and the diagnostic eyebrow both use `var(--accent)`.
- Release-validator coverage enforces the same shared accent-color contract.
- Release validator passed for SALTA v0.8.126.
- JavaScript syntax checks passed.
- TypeScript production build passed.
- Test symbol preflight passed for 99 test files.
- 99 of 99 test files passed.
- 559 of 559 tests passed.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.
