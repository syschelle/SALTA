# SALTA v0.8.141

SALTA v0.8.141 adds a dedicated daily Pushover warning for OpenCCU/HomeMatic devices that report a battery problem or become unreachable.

## Changes

- Add a separate OpenCCU/HomeMatic Pushover warning stream with its own 24-hour repeat interval.
- Include classic HomeMatic devices whose merged maintenance state reports `LOWBAT`.
- Include OpenCCU devices whose SALTA state is `reachable=false`, even when no current battery value can be read.
- Keep the warning reason explicit as `Batteriewarnung aktiv`, a reported battery percentage, and/or `nicht erreichbar`.
- Do not claim that an unreachable device is caused by a depleted battery when OpenCCU does not provide that evidence.
- Deduplicate multiple OpenCCU channels by physical HomeMatic device address so one thermostat or sensor produces one warning entry.
- Keep the existing generic battery-warning path and seven-day repeat interval for non-OpenCCU sources.
- Persist the OpenCCU warning timestamp under its own notification key so daily HomeMatic reminders do not affect other battery notifications.
- Add `OPENCCU_DEVICE_WARNING_SENT` and `PUSHOVER_OPENCCU_WARNING_FAILED` system-log diagnostics without credentials or Pushover secrets.

## Root Cause

v0.8.140 made classic BidCos `LOWBAT` maintenance data available to SALTA, but the existing generic battery monitor still used one shared seven-day repeat interval. That interval is too long for heating devices where a battery or communication problem can leave a thermostat unavailable for an extended period.

An additional failure mode exists when a HomeMatic device stops communicating before SALTA can obtain a fresh low-battery value. OpenCCU exposes this through the device maintenance state as `UNREACH`; SALTA already maps that state to `reachable=false`. A battery-only warning therefore cannot cover the important case where the device is simply no longer reachable.

v0.8.141 separates OpenCCU/HomeMatic monitoring from the generic battery cadence. A physical OpenCCU device is included when it reports a low-battery condition, a battery percentage at or below the configured threshold, or `reachable=false`. The resulting warning is repeated after 24 hours while the condition persists.

## Compatibility

- Direct upgrade from v0.8.140 is supported.
- No database schema migration is required.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain unchanged.
- Existing Pushover credentials and battery threshold remain unchanged.
- Existing OpenCCU credentials, device IDs, room assignments and automations remain unchanged.
- No HomeMatic device re-pairing or re-import is required.
- HmIP maintenance behavior is not inferred from the classic BidCos channel-0 implementation.
- No new mandatory environment variable, dependency or deployment-topology change is required.

## Tests

- Regression coverage verifies OpenCCU physical-device deduplication.
- Regression coverage verifies that an unreachable OpenCCU device is warned even without a `LOWBAT` value.
- Regression coverage verifies that a healthy reachable OpenCCU device without a battery warning is excluded.
- Regression coverage verifies the dedicated OpenCCU/HomeMatic Pushover title and warning reasons.
- Regression coverage verifies that the OpenCCU warning is suppressed before 24 hours and repeats exactly at the 24-hour boundary.
- Regression coverage verifies that OpenCCU warnings do not use the generic seven-day battery notification path.
- The release validator enforces the separate daily OpenCCU warning contract.
- The complete SALTA release validator, JavaScript syntax checks, TypeScript production build, Vitest suite and npm audit must pass in GitHub Actions before release.

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
