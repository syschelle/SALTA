# SALTA v0.4.10

SALTA v0.4.10 corrects power-meter capability detection for the classic Gen1 Shelly 1 (`SHSW-1`).

## Highlights

- Correct Shelly 1 power-meter capability detection
- No more misleading `0 W` live readings for `SHSW-1`
- Dashboard totals include only actual measured power
- Shelly 1PM measurements remain fully supported
- New Gen1 regression tests

## Shelly 1 Power Values

The classic Shelly 1 does not include physical power-measurement hardware. Its Gen1 `/status` response can contain `meters[0].power`, but this value is only a user-configured nominal appliance load and is `0` by default. It is not a real-time electrical measurement.

SALTA previously treated this value as measured power. This caused an active Shelly 1 to display `0 W` and made the device appear to support power metering.

SALTA now:

- Detects `SHSW-1` as a switch without hardware power metering
- Ignores its nominal power constant for live status display
- Removes the artificial `0 W` value from the device card
- Excludes the nominal value from the dashboard power total

## Shelly 1PM

Shelly 1PM (`SHSW-PM`) devices continue to expose real instantaneous power and cumulative energy readings. Their measurements are parsed and displayed unchanged.

## Updating

No manual database migration is required. Existing devices are corrected during the next status synchronization.

To pin this release:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.10
```

Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.10
0.4
latest
```

## Git Tag

```text
v0.4.10
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
