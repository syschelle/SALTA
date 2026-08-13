# SALTA v0.8.29

SALTA v0.8.29 prepares per-device HomeKit publication directly in the device configuration view while keeping SALTA as the single source of truth for room assignments.

## Per-device HomeKit publication

- Added a dedicated **HomeKit** section to the device configuration dialog.
- Supported devices can now be explicitly enabled or disabled for publication through the SALTA HomeKit bridge.
- Added a compatibility indicator so unsupported device types cannot accidentally be published as an incorrect HomeKit service.
- The current bridge supports switch, outlet, light, fan and compatible window-covering presentations.
- Unsupported sensors and meters are no longer coerced into a generic HomeKit switch service.
- Hidden Zigbee devices remain excluded from HomeKit even if a HomeKit publication preference exists.

## HomeKit names

- Added an optional per-device **HomeKit name** override.
- Leaving the HomeKit name empty automatically uses the normal SALTA device name.
- Changing the SALTA device name therefore also changes the HomeKit accessory name unless an explicit HomeKit name override is configured.
- The running HomeKit bridge recreates an accessory when its effective HomeKit name changes so the configured name is applied consistently.

## SALTA rooms as the HomeKit source of truth

- Added **Use SALTA room for HomeKit** and enabled it by default.
- When enabled, the desired HomeKit target room always follows the device's existing SALTA room assignment.
- Renaming a SALTA room automatically updates the in-memory HomeKit target-room metadata.
- Moving a device to another SALTA room automatically changes its HomeKit target room without requiring duplicate room maintenance.
- Deleting a SALTA room clears the inherited HomeKit target-room metadata safely.
- An optional HomeKit target-room override can select another existing SALTA room without creating a second independent room list.
- Renaming or deleting a SALTA room used as an explicit HomeKit target is also reflected automatically.

## HomeKit room limitation

- SALTA stores the desired HomeKit room assignment centrally in preparation for HomeKit publication and future tooling.
- The current HAP bridge protocol cannot force Apple Home to assign a bridged accessory to an Apple Home room.
- The room setting therefore acts as SALTA's canonical HomeKit target metadata while avoiding duplicate room definitions inside SALTA.

## Persistence

- Added the additive `device_homekit_settings` table.
- Stores the HomeKit publication flag, optional HomeKit name, SALTA-room inheritance preference and optional SALTA room override.
- Existing `homekit_enabled` values are seeded automatically into the new settings table so current HomeKit publication behavior is preserved.
- No incremental `ALTER TABLE` migration is introduced.
- No manual database command is required.
- No fresh PostgreSQL volume is required.

## Regression coverage

- Added coverage for supported and unsupported HomeKit device presentations.
- Added coverage for HomeKit name overrides.
- Added registry coverage proving that HomeKit settings survive adapter refreshes.
- Added coverage for inherited and explicit HomeKit target rooms.
- Added API coverage for HomeKit configuration and rejection of unsupported device types.
- Added frontend coverage for the new HomeKit configuration controls and SALTA-room inheritance.
- Extended release validation so the HomeKit publication controls, additive persistence and room inheritance cannot disappear silently.

## Compatibility

- No manual database migration is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- Existing Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, FRITZ!Box Presence, Daylight, virtual-device and automation functionality remains compatible.
- Existing supported Shelly and virtual devices retain their previous HomeKit enabled state.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.29.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains the patched `fast-uri` dependency versions introduced in v0.8.21.
- Retains PostCSS `8.5.23` in the development dependency tree.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.29
0.8
latest
```

## Git tag

```text
v0.8.29
```
