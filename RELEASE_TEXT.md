# SALTA v0.8.25

SALTA v0.8.25 fixes the CI regression introduced with the compact Overview changes in v0.8.24.

## Build and test fix

- Updated the room-grouped Overview frontend regression test to expect the new compact helper text introduced in v0.8.24.
- The Overview intentionally uses the shorter text `Shelly-, Zigbee-, HomeMatic- und virtuelle Geräte nach Raum.` to keep the upper dashboard section compact.
- The failing test still expected the previous longer wording and therefore caused the GitHub build to fail although the rendered Overview itself was correct.
- No runtime application behavior was changed by this fix.

## Overview behavior retained

- Keeps the compact Overview header and reduced vertical spacing from v0.8.24.
- Keeps the five compact dashboard summary cards.
- Keeps the household Presence summary using the existing `presence:house` / `presence-group` virtual device.
- Keeps Presence devices excluded from the normal device, reachable-device and power counters.
- Keeps the responsive five/three/two-column summary layout.

## Regression coverage

- Aligns `frontend-device-grouping.test.ts` with the intentional compact Overview copy.
- Retains all existing Overview grouping assertions, including room-assigned-device filtering and removal of the old status panel.
- Retains the dedicated Overview Presence regression coverage added in v0.8.24.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No API, UI behavior, automation persistence or Presence persistence format is changed.
- Existing FRITZ!Box Presence, Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device, automation and HomeKit functionality remains unchanged.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.25.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains the patched `fast-uri` dependency versions introduced in v0.8.21.
- Retains PostCSS `8.5.23` in the development dependency tree.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.25
0.8
latest
```

## Git tag

```text
v0.8.25
```
