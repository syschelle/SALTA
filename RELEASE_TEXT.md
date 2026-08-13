# SALTA v0.8.37

SALTA v0.8.37 makes the persistent System Log substantially smaller and more consistent with the compact SALTA interface. The log is now capped at the newest 100 entries across persistence, API and frontend layers.

## System Log retention

- Reduced the persistent System Log cap from 2,000 to the newest **100 entries**.
- The existing maximum age of **30 days** remains in place.
- Database initialization trims existing installations to the newest 100 records automatically.
- Every new log write also reapplies the 30-day and 100-entry cleanup rules.
- No database migration or fresh PostgreSQL volume is required.

## API limits

- `/api/logs` now defaults to 100 entries.
- Requests above 100 entries are rejected by request validation.
- The database query also clamps its limit to 100 as a defensive boundary.
- The frontend requests 100 records and applies a final client-side 100-entry guard.

## Compact SALTA-style log page

- Reduced the System Log heading and action-button footprint.
- Added a compact toolbar containing the entry count, retention note and source/severity filters.
- Reduced vertical spacing and padding between log records.
- Added compact severity badges with matching warning/error accents.
- Added localized source labels such as `OpenCCU`, `Präsenz`, `Automationen` and `Benachrichtigungen`.
- Moved timestamps into the compact record header and placed technical error codes beside the message.
- Technical detail payloads such as `failedChannels` and `catalogChannels` are now collapsed behind an expandable **Details** control instead of occupying permanent vertical space.
- Added matching dark-theme styles and responsive mobile behavior.

## Regression coverage

- Added API coverage proving that the default System Log query requests 100 entries.
- Added API coverage rejecting `limit=101`.
- Updated database schema coverage for the 100-entry persistence cleanup and query clamp.
- Updated frontend coverage for the compact toolbar, entry counter, expandable details and responsive layout.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- Existing retained log entries are automatically reduced to the newest 100 records at startup.
- Existing HomeKit, Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, FRITZ!Box Presence, climate-mode, battery-warning, Pushover, virtual-device and automation functionality remains unchanged.

## Security and dependencies

- System Log entries remain available only to authenticated SALTA sessions.
- Secret values remain excluded from log output.
- No production or development npm dependency was added or intentionally changed in v0.8.37.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains patched `fast-uri` `3.1.5` and `4.1.2`.
- Retains PostCSS `8.5.23`.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.37
0.8
latest
```

## Git tag

```text
v0.8.37
```
