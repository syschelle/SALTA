# SALTA v0.8.135

SALTA v0.8.135 keeps FRITZ!Box Smart Home device room assignments stable across synchronization and keeps the FRITZ!Box Smart Home connection state current on the Presence page.

## Changes

- Preserve SALTA room assignments for already imported FRITZ!Box Smart Home devices during the 30-second REST reconciliation cycle.
- Preserve locally configured FRITZ!Box device names, favorites and presentation overrides during reconciliation.
- Refresh the FRITZ!Box Smart Home runtime status whenever the Presence page loads or performs its regular live refresh.
- Continue using the existing FRITZ!Box presence credentials and the existing Smart Home REST adapter without changing device IDs or protocol behavior.

## Root Cause

The FRITZ!Box Smart Home mapper creates a fresh device snapshot from the FRITZ!Box REST response on every reconciliation. That snapshot intentionally contains device runtime data but does not contain SALTA-local room metadata. v0.8.134 passed the fresh snapshot directly to the registry, and the registry did not restore the existing room fields. The next periodic synchronization therefore replaced a user's saved room assignment with an unassigned device. The same path could also overwrite other local presentation fields.

The Smart Home status block on the Presence page had a separate refresh issue. Its browser module refreshed only at initial script load, on a hash change to the Presence page, on language changes, or after Smart Home-specific save/test/refresh actions. The Presence page itself refreshes every five seconds, but that live refresh did not request the current Smart Home adapter status. A successful background synchronization could therefore leave a stale connection state visible until another Smart Home action was performed.

v0.8.135 merges the existing SALTA-local device configuration into each new FRITZ!Box runtime snapshot before registry persistence and explicitly refreshes the Smart Home status as part of Presence-page refreshes.

## Compatibility

- No database schema change or manual migration is required.
- Existing FRITZ!Box Smart Home device IDs and room assignments are reused.
- Existing FRITZ!Box credentials and Smart Home opt-in settings remain unchanged.
- FRITZ!Box presence detection remains independent and unchanged.
- Existing Shelly, Phoscon/deCONZ, Hue, OpenCCU, virtual-device, automation and HomeKit data remain unchanged.
- No new npm dependency or mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.

## Tests

- Regression coverage verifies that a FRITZ!Box device keeps its SALTA room assignment after adapter reconciliation.
- Regression coverage verifies that local FRITZ!Box device name, favorite and presentation settings survive reconciliation.
- Frontend regression coverage verifies that Presence-page refreshes request the current FRITZ!Box Smart Home runtime status.
- Release validator enforces both persistence and status-refresh contracts.
- Release validator passed for SALTA v0.8.135.
- JavaScript syntax checks passed.
- TypeScript production build passed.
- Test symbol preflight passed for 106 test files.
- 106 of 106 test files passed.
- 585 of 585 tests passed.
- Full CI on main passed successfully.

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
