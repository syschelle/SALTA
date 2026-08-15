# SALTA v0.8.57

SALTA v0.8.57 fixes automation target discovery for SALTA virtual devices. Existing virtual switches are now offered reliably in step **3 · Dann** even when they were created by an older SALTA version and their persisted type, state or capability metadata is incomplete. The release also carries forward the v0.8.56 editing-stability change that pauses periodic refreshes on Automations and Settings, together with the multi-target, OpenCCU and thermostat target-temperature improvements from the preceding candidates.

## Virtual devices as automation targets

- SALTA virtual devices are now treated as binary automation targets based on their `virtual` adapter source.
- Existing and legacy persisted virtual devices are offered with `An`, `Aus` and `Toggle` even when older records do not contain the current switch type, `state.on` value or capability list.
- Frontend target discovery, automation-engine validation and virtual-adapter execution now use the same compatibility rule.
- This prevents a virtual device from being executable by SALTA but missing from the **Zielgerät** selector.
- The current virtual adapter creates switch devices only; read-only physical sensors are not affected by this fallback.
- Read-only OpenCCU contact/window sensors remain trigger/condition devices and are intentionally not exposed as automation targets.
- Added frontend, engine and virtual-adapter regression coverage for legacy virtual records.

## Stable editing carried forward from v0.8.56

- The global five-second device refresh remains paused while **Automationen** is open.
- The same global refresh remains paused while **Einstellungen** is open.
- Automation selectors and additional trigger/target editors are therefore not rebuilt underneath the user during editing.
- The periodic refresh does not call `loadAutomations()`.
- Explicit save, status and integration actions continue to refresh their own data.
- Live polling remains active on overview/device/presence pages where current values are useful.

## Multi-target and thermostat actions carried forward

- One automation can control up to eight target devices as **UND** actions.
- SALTA virtual switches support `An`, `Aus` and `Toggle`.
- Writable OpenCCU/HomeMatic switches and lights support `An`, `Aus` and `Toggle`.
- OpenCCU/HomeMatic covers support `Öffnen` and `Schließen`.
- OpenCCU/HomeMatic thermostats support `Thermostat Aus`, `Thermostat Automatik`, `Thermostat Manuell` and `Solltemperatur setzen`.
- `Solltemperatur setzen` exposes a per-target numeric temperature input and validates the value against the target thermostat range.
- Existing single-target and multi-target automations remain compatible.

## HomeKit settings improvements included

- Includes the compact and responsive **Settings → HomeKit** redesign.
- Fixes the HomeKit settings width/overflow issue.
- Hides the QR/pairing block after successful pairing.
- Includes the central **Geräte in HomeKit** publication list grouped by SALTA room.
- Supported OpenCCU thermostats and contact sensors can be enabled for HomeKit directly from the HomeKit settings page.

## Compatibility

- Builds on the released SALTA v0.8.52 baseline and supersedes the unreleased v0.8.53 through v0.8.56 candidates.
- No manual database migration is required.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- SALTA continues to use `network_mode: host` for HomeKit HAP/mDNS.
- PostgreSQL remains on Docker's normal bridge network and is published only on host loopback.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- `/opt/SALTA/migrate-homekit-storage.sh` is still required only for HomeKit pairing state created before v0.8.41.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `down -v` during the update.
