# SALTA v0.8.59

SALTA v0.8.59 adds configurable momentary virtual buttons and removes the explanatory virtual self-reset hint from the automation editor. A momentary virtual button is designed for one-shot workflows such as Apple Home geofencing: Apple Home can switch it on, SALTA reacts to the short on pulse, and the virtual button automatically returns to off after 500 ms without requiring an explicit reset action in the automation.

The release also carries forward the safe virtual-trigger self-reset support introduced in v0.8.58 for users who prefer persistent virtual switches.

## Momentary virtual buttons

- **Virtual Devices → Add virtual device** now offers **Switch** and **Momentary Button**.
- The momentary button is the default for newly opened create dialogs because it is the simpler choice for one-shot triggers.
- In SALTA the momentary variant is displayed with a button icon and a **Press** action instead of a persistent on/off switch control.
- Pressing the button produces a normal `on = true` transition and automatically returns to `on = false` after 500 ms.
- SALTA automations can therefore use the normal **On** state transition as a trigger without adding a self-reset target action.
- Existing virtual switches remain unchanged and keep their persistent on/off state.

## Existing virtual devices can be converted

- The device settings dialog now contains a **Virtual type** section for SALTA virtual devices.
- An existing virtual switch can be changed to **Momentary Button** without deleting or recreating it.
- Changing the type preserves the SALTA device ID, room assignment, HomeKit publication settings and existing automation references.
- Converting a currently-on switch to a momentary button safely normalizes it to off.
- A momentary button can also be changed back to a persistent virtual switch.

## HomeKit behavior

- Momentary virtual buttons deliberately remain writable HomeKit **Switch** accessories internally.
- This is intentional: Apple Home automations and geofences can write to a Switch characteristic, while a true stateless HomeKit button is an event source and cannot be used as the writable target of an arrival/departure automation.
- SALTA presents the device as a button in its own UI and performs the automatic off reset locally.
- No HomeKit re-pairing is required when an existing SALTA virtual switch is converted to momentary mode because its accessory identity remains unchanged.

## Automation editor cleanup

- Removed the inline hint: `Virtuelle Trigger-Schalter können sich sicher selbst zurücksetzen: An → Aus bzw. Aus → An ...`.
- The safe self-reset mechanism from v0.8.58 remains available for persistent virtual switches; only the explanatory text was removed.
- Momentary virtual buttons do not expose the redundant same-device reset target in the automation editor because they reset themselves automatically.

## v0.8.58 behavior carried forward

- Persistent virtual switches can still be both trigger and target of the same automation when the target action safely moves the switch away from the trigger state.
- `On → Off` and `Off → On` remain the only permitted same-device reset combinations.
- Safe virtual self-reset actions continue to run after the other configured target actions.
- Unsafe same-device actions and normal cross-device automation cycles remain blocked.

## Other automation capabilities carried forward

- One automation can control up to eight target devices as **AND** actions.
- SALTA virtual devices and writable OpenCCU/HomeMatic actors are available as targets.
- OpenCCU/HomeMatic thermostats support mode changes and explicit target-temperature actions.
- The global five-second live refresh remains paused on **Automations** and **Settings** so open forms and selectors are not rebuilt while editing.

## Compatibility

- Builds directly on the SALTA v0.8.58 feature set.
- Existing virtual switches and automations remain compatible.
- No database schema change is required.
- No manual database migration is required.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- SALTA continues to use `network_mode: host` for HomeKit HAP/mDNS.
- PostgreSQL remains on Docker's normal bridge network and is published only on host loopback.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- `/opt/SALTA/migrate-homekit-storage.sh` remains necessary only for HomeKit pairing state created before v0.8.41.

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
