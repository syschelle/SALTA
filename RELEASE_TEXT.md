# SALTA v0.8.106

SALTA v0.8.106 adds a bidirectional HomeKit switch for the existing global Summer/Winter heating mode. Apple Home now exposes a built-in switch named **Wintermodus**: On represents Winter mode and Off represents Summer mode.

## v0.8.106 HomeKit Winter mode switch

- Added the built-in HomeKit switch **Wintermodus**.
- **On** means SALTA Winter mode is active.
- **Off** means SALTA Summer mode is active.
- Switching the HomeKit accessory On applies the existing SALTA Winter-mode action.
- Switching the HomeKit accessory Off applies the existing SALTA Summer-mode action.
- Heating-mode changes made from the SALTA web UI, REST API or automations update the same internal state and are reflected back into HomeKit.
- Reuses the canonical `system:climate-mode` device instead of creating a second HomeKit-only state.
- The climate-mode system device remains hidden from normal SALTA device lists while being explicitly published by the HomeKit bridge.
- The HomeKit accessory is enabled automatically when HomeKit is enabled; no additional SALTA configuration or HomeKit re-pairing is required.
- Added regression and release-validator coverage for the On=Winter / Off=Summer mapping, hidden-system-device publication and state synchronization.

## v0.8.105 HomeMatic heating-mode traffic reduction carried forward

- The hourly Winter guard remains active once per hour.
- In Winter, only thermostats explicitly reported as `AUTO` are corrected to `manual`/Handbetrieb.
- Thermostats reported as `manual`, `OFF`, Boost, Party or an unknown mode are not touched by the hourly Winter guard.
- Explicit Summer/Winter application skips physical thermostats already in the requested mode.
- OpenCCU `VirtualDevices` heating groups remain excluded from global climate-mode commands to avoid duplicate HomeMatic radio traffic.
- Summer continues to enforce `OFF` for known non-OFF thermostat modes.

## v0.8.104 OpenCCU thermostat synchronization carried forward

- Classic HomeMatic/BidCos devices continue to use their native `AUTO_MODE` / `MANU_MODE` command path.
- HmIP-specific mode datapoint handling remains isolated to HmIP devices.

## v0.8.103 dependency security refresh carried forward

- Fastify remains at `5.12.5`.
- The patched `fast-uri` paths remain at `3.1.8` and `4.2.2`.
- Vitest and `@vitest/mocker` remain at `4.1.11`.
- `source-map-js` remains at `1.2.2`.
- The vulnerable `tinypool@1.1.1` path remains absent from the resolved dependency tree.

## Persistence and deployment compatibility

- No new database table is required.
- No `ALTER TABLE` statement or manual SQL migration is required.
- Existing `system:climate-mode` data is upgraded idempotently during normal database initialization.
- Existing HomeKit pairing state is preserved; HomeKit does not need to be reset or paired again.
- No dependency change is introduced by v0.8.106.
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
