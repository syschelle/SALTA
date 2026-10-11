# SALTA v0.8.102

SALTA v0.8.102 makes the global heating-mode policy deterministic: Summer keeps compatible thermostats off, while Winter always uses manual thermostat operation. SALTA now verifies that policy once per hour and automatically repairs thermostat mode drift.

## v0.8.102 hourly thermostat mode enforcement

- Winter mode now always sends **manual/Handbetrieb** to every compatible thermostat.
- Summer mode continues to send **off/Aus** to every compatible thermostat.
- Removed the configurable **Automatic** Winter thermostat mode from the heating-mode UI.
- The runtime no longer derives the Winter command from a persisted automatic/manual selector; Winter is explicitly fixed to `manual`.
- Replaced the former 12-hour Summer-only thermostat guard with a global guard that runs once per hour.
- During Winter, thermostats found in `auto` or `off` are corrected back to `manual`.
- During Summer, thermostats that are no longer `off` are corrected back to `off`.
- Applying Winter still corrects all compatible thermostats immediately; the hourly guard is an additional reliability check rather than the primary mode switch.
- Existing `winter_mode='auto'` database values are normalized idempotently to `manual` during normal database initialization.
- No table alteration, `ALTER TABLE`, manual SQL migration, new mandatory environment variable or new npm dependency is required.

## Diagnostics and regression coverage

- The thermostat guard now logs generic climate-guard correction/failure events for both Summer and Winter instead of being Summer-only.
- Existing DEBUG/Pushover behavior is preserved and now reports **Heizmodus** corrections or failures for either season.
- Added regression coverage for the exact one-hour guard interval.
- Added regression coverage proving Winter always commands `manual`, even if an old stored configuration still says `auto`.
- Added regression coverage for correcting Winter drift from `auto`/`off` to `manual`.
- Added regression coverage for correcting Summer drift to `off`.
- Added API/UI coverage preventing a new automatic Winter thermostat configuration from being selected.

## v0.8.101 fixed-IP presence recovery carried forward

- Carries forward fixed-IP identity for FRITZ!Box presence targets alongside MAC addresses.
- If a stored MAC is no longer active, SALTA can resolve the configured fixed IP and automatically refresh the stored MAC when the FRITZ!Box reports a new one.
- The AVM direct IP lookup and generic Hosts-table fallback remain unchanged.
- The additive `presence_target_network` persistence and backup/restore support remain unchanged.
- Existing targets without a fixed IP remain MAC-only until edited.

## v0.8.100 delayed contact trigger carried forward

- Carries forward **Closed for 10 seconds** for window and door contact automation triggers.
- Reopening before the 10-second interval expires cancels the pending trigger.
- Existing immediate **Open** and **Closed** triggers remain unchanged.

## v0.8.99 native timed Shelly action carried forward

- Carries forward the Shelly automation action **On for seconds** with a configurable duration from 1 to 86400 seconds.
- Shelly Gen1 uses its native `timer` query parameter; Gen2/Gen3/Gen4 RPC devices use `toggle_after`.
- The one-shot timer remains device-side and does not depend on a delayed SALTA off command.

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
