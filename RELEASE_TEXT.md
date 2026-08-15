# SALTA v0.8.58

SALTA v0.8.58 adds a safe virtual-switch self-reset pattern for automations. A SALTA virtual switch can now act as a one-shot/latch trigger and, after the automation's other target actions have been attempted, reset itself to the opposite state. This directly supports HomeKit geofence workflows where Apple Home sets a virtual switch to **On**, SALTA reacts locally, and the switch must return to **Off** so the next arrival can trigger again.

The release also carries forward the v0.8.57 virtual-target discovery fix, which keeps current and legacy SALTA virtual switches visible as automation targets even when older persisted metadata is incomplete.

## Safe virtual trigger self-reset

- A SALTA virtual switch may now be used as both trigger and target of the same automation when the target action safely moves the switch away from the state that fired the rule.
- `on = true` may reset itself with `turnOff` (**An → Aus**).
- `on = false` may reset itself with `turnOn` (**Aus → An**).
- Unsafe same-device actions such as `An → An` or `An → Toggle` remain rejected.
- Physical devices and non-virtual trigger devices still cannot target themselves.
- The automation editor now keeps an eligible virtual trigger switch in **3 · Dann → Zielgerät** instead of filtering it out.
- When the trigger switch is selected as its own target, the action selector exposes only the safe opposite-state reset action.
- The editor includes an explicit HomeKit-geofencing hint for this behavior.

## Reset runs after the other target actions

- Safe virtual self-reset actions are executed after the automation's other configured target actions have been attempted.
- This keeps the virtual switch latched while the main automation work runs and consumes/reset the trigger last.
- A failure of another target does not prevent the virtual reset from being attempted.
- Resetting the virtual switch does not retrigger the same rule because the reset moves the switch away from the configured trigger value.
- The cycle detector ignores only this narrowly defined terminating self-reset edge; normal cross-device cycle detection remains active.

## Virtual target discovery carried forward from v0.8.57

- SALTA virtual devices are treated as binary automation targets based on their `virtual` adapter source.
- Existing and legacy persisted virtual switches remain selectable with `An`, `Aus` and `Toggle` even if an older record has incomplete type/state/capability metadata.
- Frontend target discovery, automation-engine validation and virtual-adapter execution use the same compatibility rule.
- Read-only OpenCCU contact/window sensors remain trigger/condition-only.

## Stable editing and expanded targets carried forward

- The global five-second live refresh remains paused while **Automationen** or **Einstellungen** is open, preventing selectors and forms from being rebuilt during editing.
- One automation can control up to eight target devices as **UND** actions.
- Writable OpenCCU/HomeMatic switches and lights support `An`, `Aus` and `Toggle`.
- OpenCCU/HomeMatic covers support `Öffnen` and `Schließen`.
- OpenCCU/HomeMatic thermostats support `Thermostat Aus`, `Thermostat Automatik`, `Thermostat Manuell` and `Solltemperatur setzen`.
- Thermostat target temperatures remain independently configurable per target.

## Compatibility

- Builds directly on the released SALTA v0.8.57 baseline.
- Existing automations remain compatible.
- No database schema change is required for this release.
- No manual database migration is required.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- SALTA continues to use `network_mode: host` for HomeKit HAP/mDNS.
- PostgreSQL remains on Docker's normal bridge network and is published only on host loopback.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- `/opt/SALTA/migrate-homekit-storage.sh` remains necessary only for HomeKit pairing state created before v0.8.41.

## Example geofence flow

```text
Apple Home geofence
        ↓
JanaSylvioAtHome = An
        ↓
SALTA automation fires
        ↓
other target actions execute
        ↓
JanaSylvioAtHome = Aus
        ↓
ready for the next geofence arrival
```

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
