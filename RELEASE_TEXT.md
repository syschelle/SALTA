# SALTA v0.8.32

SALTA v0.8.32 fixes the CI regression in the frontend coverage for the Summer/Winter system control introduced in v0.8.31. The runtime climate-mode and battery-warning functionality is unchanged.

## Build and test fix

- Fixed `frontend-system-controls.test.ts`, which incorrectly expected `applyClimateMode('summer')` to appear in `public/app.js`.
- The Summer and Winter buttons are intentionally wired from `public/index.html` using their inline click handlers.
- The test now verifies the Summer and Winter button bindings in the HTML where those bindings actually live.
- The test separately verifies that `public/app.js` contains the `applyClimateMode(mode)` implementation and uses the `/api/system/climate-mode` endpoint.
- This keeps the regression coverage precise without weakening or removing the Summer/Winter checks.

## Existing v0.8.31 functionality retained

- Keeps the SALTA-only global Summer/Winter heating mode.
- Summer mode continues to set compatible thermostats to `OFF`.
- Winter mode continues to apply either manual or automatic operation.
- The global climate control remains excluded from HomeKit.
- Keeps central battery monitoring for percentage and explicit low-battery states.
- Keeps encrypted Pushover settings and aggregated battery warnings.
- Keeps the persistent seven-day Pushover battery-warning cooldown.
- Keeps Shelly Gen2+ `DevicePower` battery-percentage parsing.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No runtime API or persistence format is changed from v0.8.31.
- Existing HomeKit, Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, FRITZ!Box Presence, Daylight, virtual-device and automation functionality remains unchanged.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.32.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains patched `fast-uri` `3.1.5` and `4.1.2`.
- Retains PostCSS `8.5.23`.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.32
0.8
latest
```

## Git tag

```text
v0.8.32
```
