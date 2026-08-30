# SALTA v0.8.99

SALTA v0.8.99 adds a native timed Shelly automation action: **On for seconds**. Automations can switch a Shelly relay on for a freely configured whole-number duration from 1 to 86400 seconds. SALTA sends the one-shot timer to the Shelly itself instead of keeping a local delay, so the device remains responsible for switching off after the command has been accepted.

## v0.8.99 native timed Shelly automation action

- Added the automation action **On for seconds** for Shelly relay/switch components.
- Added a freely configurable whole-number duration from **1 to 86400 seconds** for the primary action and additional automation targets.
- Shelly Gen1 devices use the native relay one-shot timer: `/relay/<channel>?turn=on&timer=<seconds>`.
- Shelly Gen2, Gen3 and Gen4/RPC devices use `Switch.Set` with `on: true` and `toggle_after: <seconds>`.
- The automatic switch-off therefore runs on the Shelly itself and does not depend on a later SALTA command or an in-memory SALTA timer.
- The timed action is exposed only for Shelly `switch` components. Shelly light and cover components do not receive this action.
- Added server-side and automation-engine validation for the supported duration range and target type.
- Added regression coverage for the automation engine, frontend target catalog, Gen1 relay timer requests and Gen2+ `Switch.Set` timer requests.

## Persistence and recovery

- Added the additive `automation_timed_actions` table to store timed-action durations without altering the existing `automation_targets` constraints.
- Existing automation target rows keep their backward-compatible binary action representation while the timed-action table supplies the native duration metadata.
- Configuration backup and restore now preserve `automation_timed_actions`.
- Older configuration backups that do not contain the additive timed-action table remain importable.
- No manual SQL migration is required; SALTA creates the additive table during normal database initialization.
- Existing PostgreSQL and runtime volumes remain compatible and must not be deleted during the update.

## v0.8.98 frontend test sandbox fix carried forward

- Carries forward the v0.8.98 fix for the two isolated automation frontend VM tests after the weekday UI introduced `document.querySelectorAll()`.
- No v0.8.98 production runtime behavior is removed or reverted.

## v0.8.97 and v0.8.96 automation scheduling improvements carried forward

- Carries forward the v0.8.97 weekday API literal-union type-safety fix.
- Carries forward the v0.8.96 optional Monday-through-Sunday execution restrictions and weekend convenience control.
- Existing automations without schedule preferences continue to run on all seven days.

## Compatibility

- Existing Shelly, deCONZ, OpenCCU, Hue, HomeKit, Presence, Vacation mode and Heating mode behavior remains compatible.
- Existing automations remain compatible; the new timed action is opt-in.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update.
