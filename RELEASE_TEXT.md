# SALTA v0.8.30

SALTA v0.8.30 fixes the CI regression introduced by the new per-device HomeKit configuration in v0.8.29. The runtime HomeKit functionality remains unchanged; only outdated frontend regression expectations are aligned with the expanded device configuration payload.

## Build and test fix

- Fixed `frontend-device-name.test.ts`, which still expected the pre-v0.8.29 device configuration payload containing only `name`, `roomId` and `presentationType`.
- Fixed `frontend-device-presentation.test.ts` for the same outdated exact-string expectation.
- The tests now continue to verify device name, room and presentation persistence while also accepting and checking the HomeKit fields added in v0.8.29.
- Added explicit assertions for the per-device HomeKit publication flag and SALTA-room inheritance setting.
- No runtime JavaScript behavior was changed by this release.

## HomeKit behavior retained

- Keeps per-device **Publish to HomeKit** control.
- Keeps the optional HomeKit name override.
- Keeps **Use SALTA room for HomeKit** enabled by default.
- Keeps optional target-room overrides based on existing SALTA rooms.
- Keeps HomeKit compatibility validation for supported device presentations.
- Keeps unsupported devices from being published as an incorrect generic switch.
- Keeps existing HomeKit settings persistent across device refreshes.

## Regression coverage

- Device display-name editing still verifies that the shared dialog loads and saves the device name for every supported source.
- Device presentation tests still verify automatic, light, switch, outlet and fan roles and the resolved dashboard presentation.
- Both tests now validate the expanded configuration payload instead of relying on the obsolete exact object literal from before v0.8.29.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No device API or persistence format is changed from v0.8.29.
- Existing HomeKit settings, Shelly devices, Phoscon/Zigbee devices, OpenCCU/HomeMatic devices, FRITZ!Box Presence, Daylight, virtual devices and automations remain unchanged.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.30.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains patched `fast-uri` `3.1.5` and `4.1.2`.
- Retains PostCSS `8.5.23` in the development dependency tree.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.30
0.8
latest
```

## Git tag

```text
v0.8.30
```
