# SALTA v0.8.104

SALTA v0.8.104 fixes OpenCCU/Homematic IP thermostat mode synchronization. It separates the HmIP datapoint used to report the active operating mode from the datapoint used to command a mode change, preventing SALTA and OpenCCU from drifting into contradictory thermostat states.

## v0.8.104 OpenCCU thermostat synchronization fix

- Fixed established Homematic IP thermostat families such as `HmIP-WTH-2` to read the active mode from `SET_POINT_MODE` while sending mode changes through `CONTROL_MODE`.
- Prevented SALTA from reusing the HmIP status datapoint as the mode command endpoint.
- Preserves an already valid manual target temperature, for example 20 °C, when Winter mode only needs to ensure Handbetrieb/manual mode.
- Summer mode continues to enforce OFF. Where a HomeMatic thermostat has no dedicated off mode, SALTA continues to use manual mode plus the minimum/frost-protection temperature reported by OpenCCU.
- Added an explicit exception for newer R4M-family HmIP devices, which use `CONTROL_MODE` for status and `SET_POINT_MODE` for commands.
- Normalizes persisted or pre-v0.8.104 HmIP mode metadata when building a thermostat command, so the corrected command path is used immediately and does not depend on a prior OpenCCU registry refresh.
- Added regression coverage for HmIP-WTH-2 status/command separation, preservation of a 20 °C manual setpoint, OFF behavior and the R4M datapoint direction.
- The complete SALTA quality gate was verified in GitHub CI against the v0.8.103 baseline plus this fix.

## Root cause

SALTA previously preferred `SET_POINT_MODE` as both the HmIP mode status source and the writable mode parameter. On established Homematic IP thermostat families those responsibilities are split: `SET_POINT_MODE` reflects the active mode, while `CONTROL_MODE` is the command endpoint. This mismatch could make the state shown by SALTA disagree with OpenCCU and could cause the hourly Summer/Winter thermostat guard to apply the wrong correction after a manual change in OpenCCU.

## v0.8.103 dependency security refresh carried forward

- Fastify remains at `5.12.5`.
- The patched `fast-uri` paths remain at `3.1.8` and `4.2.2`.
- Vitest and `@vitest/mocker` remain at `4.1.11`.
- `source-map-js` remains at `1.2.2`.
- The vulnerable `tinypool@1.1.1` path remains absent from the resolved dependency tree.

## v0.8.102 hourly thermostat-mode enforcement carried forward

- Winter mode always enforces **manual/Handbetrieb** on compatible thermostats.
- Summer mode enforces **off/Aus**.
- SALTA verifies this policy once per hour and repairs mode drift.
- v0.8.104 corrects the OpenCCU/HmIP command mapping used by that guard; the global policy itself is unchanged.

## Persistence and deployment compatibility

- No database schema change is required.
- No `ALTER TABLE` statement or manual SQL migration is required.
- No dependency change is introduced by v0.8.104.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL and SALTA runtime volumes remain compatible and must be preserved.
- SALTA continues to use `network_mode: host` for HomeKit/mDNS while PostgreSQL remains bound to host loopback through `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`.

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
