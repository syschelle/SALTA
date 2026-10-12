# SALTA v0.8.118

SALTA v0.8.118 fixes classic BidCos/HomeMatic thermostats that remain physically OFF when a higher target temperature is applied, and hardens the sanitized diagnostic export introduced in v0.8.117.

## Changes

- Classic `BidCos-RF` thermostats that are currently in SALTA's synthetic `off` state now leave OFF through the native `MANU_MODE=<requested temperature>` command when a target above the device minimum is requested.
- The OFF recovery is deliberately narrow: classic thermostats already in Manual or Auto continue to receive only their native target-temperature datapoint, normally `SET_TEMPERATURE`.
- Homematic IP target-temperature routing is unchanged and continues to use the discovered HmIP target datapoint, normally `SET_POINT_TEMPERATURE`.
- A minimum-temperature request while already OFF remains a target-temperature write and does not unnecessarily re-enter manual operation.
- The local projected state after a successful classic OFF recovery is `manual` with the requested target temperature, while OpenCCU diagnostics continue to record the exact `Interface.setValue` datapoint and value.
- The sanitized diagnostic export is upgraded to format version 2.
- JavaScript `Date` values in diagnostic exports are preserved as ISO timestamps instead of becoming empty objects.
- Presence devices in the general device registry no longer expose MAC addresses, IP addresses, host names or configured presence network identifiers.
- OpenCCU/HomeMatic datapoint metadata required for troubleshooting remains available in the diagnostic export.
- The release-version helper now correctly handles both active GHCR image references in `GIT_COMMANDS.md` instead of refusing an otherwise valid version bump.

## Root Cause

The v0.8.117 execution diagnostic proved that the Nachtabsenkung automation completed all four thermostat actions and that SALTA sent exactly one `SET_TEMPERATURE=15` write to each `HM-TC-IT-WM-W-EU`. The physical wall thermostats nevertheless remained OFF.

For these classic HomeMatic devices, SALTA represents the device's manual mode at the minimum target temperature as synthetic `off`. Raising only `SET_TEMPERATURE` from that state can leave the physical thermostat in its OFF representation. The native HomeMatic `MANU_MODE` action carries the manual target temperature and is therefore required specifically when leaving this classic OFF state.

v0.8.114 correctly separated ordinary temperature changes from operating-mode changes, but its regression rule was too broad because it also prohibited the native OFF-to-manual recovery path. v0.8.118 restores only that narrow exception while retaining target-only behavior for classic Manual/Auto operation and all existing HmIP routing.

The v0.8.117 diagnostic sanitizer also treated `Date` objects as generic objects, producing `{}`, and presence devices passed through the general device export with network identifiers that were not covered by the presence-target allow-list. Both export paths are corrected in v0.8.118.

## Compatibility

- No database schema change or migration is required.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing automations require no editing.
- Existing PostgreSQL and SALTA runtime volumes remain compatible.
- Existing HomeKit pairing state remains compatible.
- The thermostat change is limited to classic `BidCos-RF` devices that SALTA currently reports as `off` and only when requesting a target above the minimum temperature.
- Classic Manual/Auto and Homematic IP target-temperature behavior remain unchanged.

## Tests

- Regression coverage verifies classic BidCos OFF → `MANU_MODE=<temperature>` recovery.
- Regression coverage verifies that classic Manual and Auto still use `SET_TEMPERATURE` only.
- Regression coverage verifies that HmIP does not inherit the classic BidCos OFF exception.
- Regression coverage verifies that requesting the minimum temperature while OFF does not unnecessarily issue `MANU_MODE`.
- Diagnostic-export coverage verifies removal of presence MAC/IP/host identifiers while preserving OpenCCU datapoint metadata.
- Diagnostic-sanitizer coverage verifies ISO preservation of valid dates and safe handling of invalid dates.
- Release-version tooling coverage is exercised by the v0.8.118 release preparation itself.
- Release validator, JavaScript syntax checks and TypeScript build pass in GitHub Actions.
- 92 of 92 test files pass.
- 538 of 538 tests pass.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.
