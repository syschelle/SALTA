# SALTA v0.8.56

SALTA v0.8.56 keeps automation and settings forms stable by pausing the global five-second live-value refresh while those pages are open. This prevents device refreshes from rebuilding selectors or form state underneath the user while an automation or integration setting is being edited. The release also carries forward the v0.8.55 thermostat target-temperature action and the expanded virtual/OpenCCU automation target support from the preceding candidate.

## Stable editing on Automations and Settings

- The global five-second `/api/devices` live refresh is paused while **Automationen** is the active page.
- The same global live refresh is paused while **Einstellungen** is the active page.
- The periodic refresh no longer calls `loadAutomations()`, so open automation selectors and additional trigger/action editors are not rebuilt every five seconds.
- Settings panels still load their current data when opened.
- Explicit save, test, pairing-status, presence-refresh and other user-triggered actions continue to refresh the data they own.
- Live device polling remains active on overview/device/presence pages where continuously updated values are useful.
- Added regression coverage and release validation so future changes cannot silently reintroduce automatic automation/settings form refreshes.

## Thermostat target-temperature actions carried forward

- Includes the v0.8.55 **Solltemperatur setzen** automation action for thermostats exposing `setTargetTemperature`.
- Step **3 · Dann** shows a numeric temperature input for that action.
- The primary target and every additional thermostat target can store and execute an independent target temperature.
- Temperature inputs use device minimum/maximum/step metadata when available and are validated again by the automation engine.
- Automation summaries include the configured target temperature.

## Expanded automation target devices carried forward

- SALTA virtual switches can be selected as targets with `An`, `Aus` and `Toggle`.
- Writable OpenCCU/HomeMatic switches and lights can be selected with `An`, `Aus` and `Toggle`.
- OpenCCU/HomeMatic covers can be selected with `Öffnen` and `Schließen`.
- OpenCCU/HomeMatic thermostats can be selected with `Thermostat Aus`, `Thermostat Automatik`, `Thermostat Manuell` and `Solltemperatur setzen`.
- Read-only sensors such as window contacts remain trigger/condition devices and are intentionally not offered as targets.
- Up to eight target devices can be executed by one automation as **UND** actions.

## Persistence and execution safety

- Existing single-target and multi-target automations remain compatible.
- The additive `automation_targets` persistence introduced for extended actions and optional temperature values remains unchanged.
- No destructive `ALTER TABLE` migration is used.
- Trigger/target conflicts, duplicate target devices and automation cycles remain rejected.
- If one target fails, remaining target actions continue to run and per-target diagnostics are recorded.

## HomeKit settings improvements included

- Includes the compact and responsive **Settings → HomeKit** redesign.
- Fixes the HomeKit settings width/overflow issue.
- Hides the QR/pairing block completely after successful pairing.
- Includes the central **Geräte in HomeKit** publication list grouped by SALTA room.
- Supported OpenCCU thermostats and contact sensors can be enabled for HomeKit directly from the HomeKit settings page.

## Compatibility

- Builds on the released SALTA v0.8.52 baseline and supersedes the unreleased v0.8.53, v0.8.54 and v0.8.55 candidates.
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
