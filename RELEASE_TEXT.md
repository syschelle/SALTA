# SALTA v0.8.12

SALTA v0.8.12 adds first-class support for the virtual deCONZ/Phoscon Daylight sensor and makes its daylight state directly usable by SALTA automations.

## Phoscon Daylight sensor

- Added support for the deCONZ `Daylight` sensor (`PHDL00` / `type: Daylight`), which was previously skipped by the ZHA/ZGP-only sensor filter.
- Imports the Daylight resource as a read-only SALTA light sensor.
- Exposes the boolean `daylight` and `dark` states.
- Exposes the calculated `sunrise` and `sunset` values reported by deCONZ.
- Exposes the deCONZ daylight status as `daylightStatus`.
- Translates the official deCONZ daylight status codes into readable German solar phases in the web interface.
- Displays sunrise and sunset as compact local clock times on the device card.

## Automations

- `daylight` and `dark` are available automatically as boolean automation triggers.
- `daylight` and `dark` can also be used as the optional automation condition.
- Example: motion detected AND Daylight `dark = true` -> turn on a light.
- Example: Daylight changes to `daylight = false` -> switch on outdoor lighting.
- No new automation trigger type or database migration is required; the existing boolean-state automation engine is reused.

## Realtime updates

- Daylight changes are processed through the existing deCONZ WebSocket sensor-update path.
- Added handling for Daylight solar-phase status updates even when a WebSocket event contains only the numeric `status` field.
- The normal 15-second Phoscon reconciliation remains as the state recovery path after reconnects.

## Compatibility

- No database migration is required.
- No `ALTER TABLE` migration is introduced.
- No fresh PostgreSQL volume is required.
- No new environment variables are required.
- Existing v0.8.x automations remain compatible.
- Existing Phoscon/Zigbee devices and button-event automations remain unchanged.

## Security and dependencies

- No production npm dependency was added or intentionally changed in v0.8.12.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7.

## Verification

The release validation and browser JavaScript/shell syntax checks pass locally. The complete Vitest/TypeScript dependency-backed suite requires `npm ci`; the package mirror available in the build environment returned HTTP 404 for the locked `zod` tarball, so that full suite could not be executed here.

## Container tags

```text
0.8.12
0.8
latest
```

## Git tag

```text
v0.8.12
```
