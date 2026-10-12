# SALTA v0.8.123

SALTA v0.8.123 makes the automation overview easier to scan by grouping rules by their assigned SALTA room.

## Changes

- Automations are grouped by their existing SALTA room assignment in the automation overview.
- Room groups follow the order configured in SALTA room management.
- Only rooms that currently contain automations are displayed.
- Automations without a valid room assignment are collected in a final `Ohne Raum` group.
- The existing order of automations inside each room is preserved.
- Existing automation cards, controls and room badges remain available.
- Trigger, condition, action, schedule and execution behavior are unchanged.

## Root Cause

The automation data model already stored a `roomId`, and SALTA already maintained an explicit room order, but the automation overview rendered every rule into one flat list. With more automations this made rules from different rooms harder to scan even though the required grouping information was already available.

v0.8.123 changes only the overview presentation. It reuses the existing room assignment and room order and does not change automation execution semantics.

## Compatibility

- No database schema change or migration is required.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing automations require no editing.
- Existing room assignments remain unchanged.
- Existing PostgreSQL and SALTA runtime volumes remain compatible.
- Existing HomeKit pairing state remains compatible.
- OpenCCU, Shelly, Phoscon, Hue and presence integrations are unchanged.

## Tests

- Regression coverage verifies that room groups follow SALTA room-management order.
- Regression coverage verifies that automations without a valid room are placed in the final `Ohne Raum` group.
- Regression coverage verifies the compact grouped layout.
- Release validator passed for SALTA v0.8.123.
- JavaScript syntax checks passed.
- TypeScript production build passed.
- Test symbol preflight passed for 97 test files.
- 97 of 97 test files passed.
- 553 of 553 tests passed.

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
