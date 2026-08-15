# SALTA v0.8.55

SALTA v0.8.55 extends multi-target automations with thermostat target-temperature input and carries forward the expanded target-device catalog from the v0.8.54 candidate. Automations can now control Shelly devices, SALTA virtual switches and writable OpenCCU/HomeMatic devices, including setting an explicit thermostat target temperature per target.

## Thermostat target-temperature actions

- Added **Solltemperatur setzen** as an automation action for thermostats exposing `setTargetTemperature`.
- Step **3 · Dann** shows a numeric temperature input whenever this action is selected.
- The input uses the thermostat's own minimum, maximum and step metadata when available; OpenCCU defaults remain compatible with the existing 0.5 °C target-temperature handling.
- The primary target and every additional target can use its own independent target temperature.
- Automation cards include the configured temperature in the compact **Dann** summary, for example `Wohnzimmerthermostat → Solltemperatur setzen · 21,5 °C`.
- API validation requires a numeric value for `setTargetTemperature` and rejects values on actions that do not use a temperature.
- The automation engine validates the requested temperature against the selected device's supported range before saving and sends the value through the shared command router with `source: "automation"`.

## Expanded automation target devices

This release also includes the target-device expansion prepared in the v0.8.54 candidate:

- SALTA virtual switches can be selected as automation targets with `An`, `Aus` and `Toggle`.
- Writable OpenCCU/HomeMatic switches and lights can be selected with `An`, `Aus` and `Toggle`.
- OpenCCU/HomeMatic covers can be selected with `Öffnen` and `Schließen`.
- OpenCCU/HomeMatic thermostats can be selected with `Thermostat Aus`, `Thermostat Automatik`, `Thermostat Manuell` and now `Solltemperatur setzen`.
- Read-only OpenCCU sensors such as window contacts remain trigger/condition devices and are intentionally not offered as targets.
- One automation can control up to eight target devices, with all configured targets executed as **UND** actions.

## Additive automation target persistence

- Added the canonical `automation_targets` table for all automation target actions, positions `0` through `7`.
- `automation_targets` stores the target device, extended action and optional numeric value required by target-temperature actions.
- Existing `automations.action` and `automation_actions` storage remains intact as legacy compatibility storage for the original `An` / `Aus` / `Toggle` action set.
- Existing simple automations are copied into the canonical target table automatically during normal schema initialization.
- The change is additive; no destructive `ALTER TABLE` migration is used and no manual database migration is required.
- Configuration/disaster-recovery backups now export and restore `automation_targets`.
- Existing format-v1 backups without `automation_actions` and/or `automation_targets` remain accepted.

## Execution safety

- Every configured target device is validated before an automation is saved.
- A trigger device cannot also be a target of the same automation.
- A target device cannot be configured twice in one automation.
- Cycle protection includes every target action.
- If one target is unreachable or one command fails, SALTA continues executing the remaining targets.
- Individual skipped or failed target actions are recorded in the system log.
- An automation is marked as triggered when at least one target action succeeds.

## HomeKit settings improvements included

- Includes the compact and responsive **Settings → HomeKit** redesign prepared after v0.8.52.
- Fixes the HomeKit settings width/overflow issue.
- Hides the QR/pairing block completely after successful pairing.
- Adds a central **Geräte in HomeKit** list grouped by SALTA room.
- Supported OpenCCU thermostats and contact sensors can be enabled for HomeKit directly from the HomeKit settings page.
- Contact sensors show their live open/closed state; thermostats show current/target temperature and operating mode when available.
- Hidden Zigbee devices remain excluded from HomeKit.

## Compatibility

- Builds on the released SALTA v0.8.52 baseline and supersedes the unreleased v0.8.53 and v0.8.54 candidates.
- Existing single-target and multi-target automations remain compatible.
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
