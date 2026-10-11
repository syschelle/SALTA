# SALTA v0.8.105

SALTA v0.8.105 makes the global Summer/Winter thermostat guard conservative for classic HomeMatic/OpenCCU installations. The hourly check stays enabled, but Winter now writes to a thermostat only when OpenCCU explicitly reports that device as being in Auto mode.

## v0.8.105 HomeMatic heating-mode traffic reduction

- The hourly Winter guard remains active once per hour.
- In Winter, only thermostats explicitly reported as `AUTO` are corrected to `manual`/Handbetrieb.
- Thermostats reported as `manual`, `OFF`, Boost, Party or an unknown mode are not touched by the hourly Winter guard.
- Explicitly applying Winter mode still switches physical thermostats that are not already manual to `manual`.
- Summer mode continues to enforce `OFF`; the hourly Summer guard corrects known non-OFF states back to `OFF`.
- Unknown/ambiguous thermostat states are not repeatedly written by the hourly guard.
- Explicit Summer/Winter application skips thermostats that are already in the requested mode.
- OpenCCU `VirtualDevices` heating groups are excluded from the global heating-mode target set to avoid sending the same logical mode change to a virtual group and its physical thermostat members.
- This reduces unnecessary HomeMatic RF commands and therefore avoids needless Duty Cycle consumption during periodic verification.

## Root cause

The previous guard treated every state other than the configured target as drift. During Winter mode this meant that anything not reported exactly as `manual` was rewritten once per hour. A diagnostic run showed 10 of 11 thermostats classified as mismatched and corrected in one pass. On classic HomeMatic installations that can create a large burst of RF traffic even when the user's real requirement is only to recover from an accidental switch back to Auto mode.

## v0.8.104 OpenCCU thermostat synchronization carried forward

- The OpenCCU thermostat mode mapping fixes from v0.8.104 remain present.
- Classic HomeMatic/BidCos devices continue to use their native `AUTO_MODE` / `MANU_MODE` command path.
- HmIP-specific status/command handling remains isolated to HmIP devices and does not replace classic HomeMatic command handling.

## v0.8.103 dependency security refresh carried forward

- Fastify remains at `5.12.5`.
- The patched `fast-uri` paths remain at `3.1.8` and `4.2.2`.
- Vitest and `@vitest/mocker` remain at `4.1.11`.
- `source-map-js` remains at `1.2.2`.
- The vulnerable `tinypool@1.1.1` path remains absent from the resolved dependency tree.

## Persistence and deployment compatibility

- No database schema change is required.
- No `ALTER TABLE` statement or manual SQL migration is required.
- No dependency change is introduced by v0.8.105.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL and SALTA runtime volumes remain compatible and must be preserved.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL and SALTA runtime volumes.
