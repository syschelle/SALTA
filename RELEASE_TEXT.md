# SALTA v0.8.125

SALTA v0.8.125 makes automation events easier to identify in the System Log by showing the configured automation name directly in the visible log topic.

## Changes

- Automation log topics now append the configured automation name when it is present in the existing diagnostic details.
- A visible entry such as `Automation executed` can now appear as `Automation executed · Nachtabsenkung`.
- The behavior applies consistently to automation execution start, wait, action, failure, finish and triggered messages that already carry `automationName`.
- The technical log code remains unchanged and stays visible next to the topic.
- The complete automation diagnostic details remain available through the existing expandable Details section and sanitized diagnostic export.
- System-log filtering and repeat aggregation introduced in v0.8.124 are unchanged.

## Root Cause

SALTA already stored the automation ID and configured automation name in the diagnostic details of automation execution log entries. The System Log overview, however, rendered only the generic `message` field as its visible topic. Users therefore had to open the Details section to determine which automation produced an entry such as `AUTOMATION_TRIGGERED`.

v0.8.125 reuses the existing `details.automationName` value in the presentation layer and appends it to the visible topic. No automation execution or persistence behavior is changed.

## Compatibility

- No database schema change or migration is required.
- Existing system-log rows remain compatible.
- Existing automation definitions require no editing.
- System-log filtering, repeat aggregation and diagnostic export remain compatible.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.
- OpenCCU, Shelly, Phoscon, Hue and presence integrations are unchanged.

## Tests

- Regression coverage verifies that automation log topics use the existing `automationName` diagnostic field.
- Release-validator coverage requires the automation-name presentation contract.
- Release validator, JavaScript syntax checks, TypeScript production build and complete test suite are executed by GitHub Actions before release.

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
