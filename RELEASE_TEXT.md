# SALTA v0.8.112

SALTA v0.8.112 fixes classic HomeMatic thermostat night-setback behavior. A normal SALTA target-temperature action must never leave a classic HomeMatic thermostat in OFF when the installation is operating in manual Winter mode.

## v0.8.112 classic HomeMatic manual setpoint fix

- Classic BidCos/HomeMatic thermostats now use their native `MANU_MODE=<temperature>` command when SALTA changes the target temperature while the device reports `manual` or `off`.
- Example: a night-setback action to 15.0 °C now writes `MANU_MODE=15.0`, which applies the setpoint and keeps/restores Handbetrieb atomically.
- This matches the classic HomeMatic command model where `MANU_MODE` is a writable temperature command and `CONTROL_MODE` is the reported operating mode.
- The HomeMatic OFF representation remains the minimum manual temperature (typically 4.5 °C); a requested value above the minimum now results in `manual`, not `off`.
- If a classic thermostat explicitly reports `auto`, an ordinary target-temperature action continues to use `SET_TEMPERATURE` so the action does not silently change Auto to Manual.
- HmIP devices are explicitly kept on their existing target-temperature datapoint path and are not routed through classic `MANU_MODE`, even if stale metadata contains a manual-mode field.
- Added regression coverage for classic HomeMatic manual, OFF and AUTO states and for HmIP isolation.

## Root cause

SALTA previously implemented `setTargetTemperature` by writing only the discovered target-temperature datapoint (`SET_TEMPERATURE` on classic HomeMatic devices). That is sufficient for a generic setpoint write, but it does not express the native classic HomeMatic manual-mode command. Classic HomeMatic devices use `MANU_MODE` itself as a writable temperature action; writing a temperature to `MANU_MODE` both selects manual mode and applies the requested setpoint.

For Winter/night-setback rules this distinction matters. v0.8.112 therefore preserves generic Auto behavior but uses the native manual command whenever a classic thermostat is already manual or OFF.

## Validation

The exact functional fix and its regression coverage were validated through the normal GitHub quality gate against the v0.8.111 baseline:

- `npm ci` passed.
- Release validation passed.
- Test-symbol preflight passed for 83 test files.
- `tsc -p tsconfig.json` passed.
- The complete Vitest suite passed: **83 test files / 517 tests**.
- The four new v0.8.112 HomeMatic/HmIP regression tests passed.
- Dynamic CodeQL PR analysis passed.

The validation-only draft PR was closed without merge after the successful checks.

## v0.8.111 TypeScript sequence fix carried forward

- Canonical automation sequences remain explicitly typed as `AutomationSequenceStep[]`.
- The production TypeScript build no longer fails on the action/`wait` discriminated union.
- Existing sequence runtime behavior remains unchanged.

## v0.8.110 fully editable sequences carried forward

- Every **Then** step remains part of one canonical ordered sequence.
- Existing Step 1 can be moved or deleted like later steps.
- Action and Wait steps can be reordered across the complete sequence.
- At least one real action remains required.

## v0.8.109 dedicated editor carried forward

- Automation creation and editing remain on the dedicated full-width `#automation-editor` page.
- Basics, execution days, **When**, **Only if** and **Then** remain visually separated.

## v0.8.108 ordered sequences carried forward

- Up to eight ordered action/Wait steps are supported.
- Wait values remain restricted to whole seconds from `1` to `86400`.
- Wait steps remain asynchronous and do not block unrelated automations.
- Ordered sequences remain persisted in `automation_sequence_steps` and preserved by backup/restore.

## HomeKit system controls carried forward

- **Winter** remains the bidirectional HomeKit switch for Summer/Winter heating mode.
- **Urlaub** remains the bidirectional HomeKit switch for vacation mode.
- Existing HomeKit pairing state is preserved.

## HomeMatic thermostat guard carried forward

- In Winter, the hourly guard only corrects thermostats explicitly reported as `AUTO` back to manual mode.
- Manual, OFF, Boost, Party and unknown states are not repeatedly rewritten by the Winter guard.
- OpenCCU `VirtualDevices` heating groups remain excluded from global climate-mode commands.
- Summer continues to enforce OFF for known non-OFF physical thermostat states.

## Persistence and deployment compatibility

- No new database table is introduced.
- No `ALTER TABLE` statement or manual SQL migration is required.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL and SALTA runtime volumes remain compatible and must be preserved.
- Existing HomeKit pairing state remains compatible.

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
