# SALTA v0.8.107

SALTA v0.8.107 expands the built-in HomeKit system controls. The heating-mode switch now uses the shorter **Winter** label, and SALTA vacation mode is available as a second bidirectional HomeKit switch named **Urlaub**.

## v0.8.107 HomeKit Winter and vacation switches

- Renamed the existing HomeKit heating-mode switch from **Wintermodus** to **Winter**.
- **Winter On** means SALTA Winter mode is active.
- **Winter Off** means SALTA Summer mode is active.
- Added the built-in HomeKit switch **Urlaub**.
- **Urlaub On** enables the existing SALTA vacation mode.
- **Urlaub Off** disables the existing SALTA vacation mode.
- HomeKit vacation-mode writes call the canonical `VacationModeManager`; no separate HomeKit-only vacation state is created.
- Changes made from the SALTA web UI or REST API update `system:vacation-mode` and are reflected back into HomeKit.
- The existing `system:climate-mode` and `system:vacation-mode` devices remain hidden from normal SALTA device lists while being explicitly published by the HomeKit bridge.
- Database initialization upgrades both system devices idempotently and enables the HomeKit names **Winter** and **Urlaub**.
- Existing HomeKit bridge pairing state is preserved; no HomeKit reset or re-pair is required.
- Added regression and release-validator coverage for both system switches, their names and their bidirectional mappings.

## v0.8.106 HomeKit heating-mode switch carried forward

- The global Summer/Winter heating mode remains exposed through the canonical `system:climate-mode` device.
- HomeKit writes continue to use the same central climate manager used by SALTA UI and automations.
- The switch state remains synchronized through `state.on`, with On = Winter and Off = Summer.

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
- Existing `system:climate-mode` data is upgraded idempotently to the HomeKit name **Winter**.
- Existing `system:vacation-mode` data is upgraded idempotently to a HomeKit-capable switch named **Urlaub**.
- Existing HomeKit pairing state is preserved; HomeKit does not need to be reset or paired again.
- No dependency change is introduced by v0.8.107.
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
