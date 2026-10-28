# SALTA v0.8.139

SALTA v0.8.139 makes HomeKit-controlled Shelly switches resilient to slow or missing HTTP responses and adds the diagnostics needed to identify the origin of unexpected HomeKit switching commands.

## Changes

- Add persistent HomeKit command diagnostics for requested, successful and failed device commands, including the target device and requested capability/value.
- Keep HomeKit Shelly switch writes responsive by acknowledging a confirmed on/off command without waiting for a complete Shelly device re-probe.
- Use a two-second response wait for HomeKit Shelly on/off commands so a slow Shelly response does not cross HomeKit's slow-write warning window.
- If a Shelly response times out after a HomeKit on/off write, record the write as delivery-uncertain instead of returning `DETECTION_TIMEOUT` to HomeKit.
- Hold the requested on/off state optimistically until SALTA's existing Shelly reconciliation loop verifies the authoritative device state.
- Keep API, automation and system command paths unchanged, including their existing synchronous post-command readback.

## Root Cause

A diagnostic export from v0.8.138 showed HomeKit `slow-write` warnings for the `On` characteristic of the `TV` accessory followed by `DETECTION_TIMEOUT`. The TV is a Gen1 Shelly Plug S controlled through SALTA's HomeKit bridge.

SALTA's HomeKit handler awaited the complete Shelly command promise. Shelly HTTP requests used a 3.5-second timeout. A Shelly can physically execute a relay command before SALTA receives the complete HTTP response, so a delayed response can leave the device already switched while HomeKit still receives a timeout. The same synchronous path also performed an immediate full Shelly refresh after a confirmed command.

v0.8.139 separates HomeKit acknowledgement from authoritative reconciliation for Shelly switch writes. A confirmed write is acknowledged immediately after the command response. A response timeout is logged as delivery-uncertain and resolved optimistically; SALTA's existing reconciliation loop then verifies the real device state. The new HomeKit command log records whether HomeKit requested `turnOn` or `turnOff`, which makes future unexpected switching events traceable without guessing.

## Compatibility

- Direct upgrade from v0.8.138 is supported.
- No database schema migration is required.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain unchanged.
- Existing HomeKit pairing is preserved; no HomeKit reset or re-pair is required.
- Existing Shelly device configuration and credentials remain unchanged.
- API, automation and system command behavior remains unchanged.
- No new environment variable or production topology change is required.

## Tests

- Regression coverage verifies that a confirmed HomeKit Gen1 Shelly switch write does not synchronously perform a full `/settings` + `/status` re-probe.
- Regression coverage verifies that a HomeKit Shelly command response timeout resolves optimistically and logs `SHELLY_HOMEKIT_COMMAND_RESPONSE_TIMEOUT` instead of surfacing `DETECTION_TIMEOUT` to HomeKit.
- Structural HomeKit coverage verifies requested/succeeded/failed command-origin diagnostics.
- The complete SALTA release validator, JavaScript syntax checks, TypeScript production build and Vitest suite must pass in GitHub Actions before integration to `main`.
- `npm audit --audit-level=low` must complete without known npm advisories.

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
