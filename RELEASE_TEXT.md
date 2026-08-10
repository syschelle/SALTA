# SALTA v0.8.27

SALTA v0.8.27 improves Shelly device diagnostics by making the last successful contact time clearly visible in the device configuration view and by correcting the underlying `lastSeen` semantics for unreachable Shelly devices.

## Shelly last-seen indicator

- Added a prominent **Last seen** / `Zuletzt gesehen` indicator to the metadata row at the top of the Shelly device configuration dialog.
- The value is formatted using the local browser date and time and is visible immediately next to the Shelly source, resolved device type and room.
- The existing **Last seen** entry remains available in the read-only technical Device information section as well.
- Other device sources keep their existing detail presentation; the additional header indicator is Shelly-specific.

## Correct lastSeen semantics

- Fixed Shelly refresh failures incorrectly updating `lastSeen` to the time of the failed poll.
- `lastSeen` now changes only after a successful Shelly probe/refresh.
- When a Shelly becomes unreachable, SALTA sets the device to offline while preserving the timestamp of the last successful contact.
- This makes the displayed value useful for diagnosing when an offline Shelly was actually last reachable instead of when SALTA most recently attempted a poll.
- No additional database field or migration is required because SALTA continues to use the existing persisted `last_seen` column.

## Regression coverage

- Added frontend regression coverage for the Shelly-specific **Zuletzt gesehen** header indicator and the existing technical information row.
- Added Shelly adapter regression coverage proving that a failed refresh preserves the previous successful `lastSeen` timestamp.
- Existing Shelly state refresh, presentation override and lifecycle behavior remains unchanged.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No device API or persistence format is changed.
- Existing Shelly credentials, rooms, presentation overrides, automations and HomeKit exports remain compatible.
- Existing FRITZ!Box Presence, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device and automation functionality remains unchanged.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.27.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains the patched `fast-uri` dependency versions introduced in v0.8.21.
- Retains PostCSS `8.5.23` in the development dependency tree.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.27
0.8
latest
```

## Git tag

```text
v0.8.27
```
