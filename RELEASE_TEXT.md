# SALTA v0.8.134

SALTA v0.8.134 adds a dedicated FRITZ!Box Smart Home device page so imported FRITZ!Box devices are directly visible and controllable inside SALTA.

## Changes

- Add a dedicated **FRITZ!Box** entry to the main navigation between Philips Hue and HomeMatic.
- Add a dedicated FRITZ!Box Smart Home device page using the existing SALTA room-grouped device renderer.
- Show devices without a SALTA room assignment under **Nicht zugeordnet / Unassigned** instead of making them effectively invisible from the room-only overview.
- Reuse the existing SALTA device cards and controls, including thermostat target-temperature control, favorites, room assignment and device configuration.
- Add FRITZ!Box room filtering and device search.
- Add a page-level synchronization action using the existing authenticated `/api/fritzbox/smarthome/refresh` endpoint.
- Keep the existing FRITZ!Box Smart Home opt-in settings and FRITZ!Box presence integration unchanged.

## Root Cause

FRITZ!Box Smart Home devices were already imported into the SALTA registry with source `fritzbox`, but the main application had no dedicated FRITZ!Box device page. The overview intentionally displays only devices that have a valid SALTA room assignment. Newly imported FRITZ!Box devices without a room therefore had no obvious place in the user interface even though synchronization reported them as successfully integrated.

v0.8.134 adds an explicit FRITZ!Box navigation target and renders the existing imported devices with the shared SALTA device UI. Devices that do not yet have a room appear under the standard **Unassigned** group and can be assigned through the existing device configuration dialog.

## Compatibility

- No database schema change or manual migration is required.
- Existing FRITZ!Box credentials and Smart Home opt-in settings remain unchanged.
- Existing imported FRITZ!Box device IDs, states and room assignments remain unchanged.
- FRITZ!Box presence detection remains independent and unchanged.
- Existing Shelly, Phoscon/deCONZ, Hue, OpenCCU, virtual-device, automation and HomeKit data remain unchanged.
- No new npm dependency or mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.

## Tests

- Verify that the FRITZ!Box navigation entry is positioned between Philips Hue and HomeMatic.
- Verify the dedicated FRITZ!Box page, room filter, search field and device grid.
- Verify that source `fritzbox` is wired to the shared room-grouped device renderer.
- Verify that the page-level synchronization button uses the existing authenticated Smart Home refresh endpoint.
- Release validator passed for SALTA v0.8.134.
- JavaScript syntax checks passed.
- TypeScript production build passed.
- Test symbol preflight passed for 104 test files.
- 104 of 104 test files passed.
- 583 of 583 tests passed.
- Full CI on `main` passed successfully.

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
