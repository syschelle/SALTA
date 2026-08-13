# SALTA v0.8.35

SALTA v0.8.35 moves the Winter thermostat target-mode configuration out of the Overview and into a dedicated Settings panel, keeping the Overview focused on the actual Summer/Winter switch.

## Winter-mode configuration in Settings

- Added **Settings → Heizmodus** as a dedicated global configuration area.
- The Winter target mode can be configured as either:
  - `Handbetrieb` / manual
  - `Automatik` / automatic
- Saving this setting only persists the configuration and **does not immediately switch any thermostat**.
- Added **Aktuellen Modus jetzt anwenden** for an explicit save-and-apply action when an immediate thermostat update is desired.
- The Settings panel shows the current Summer/Winter state, configured Winter mode, supported thermostat count, last application time and last command result.

## Cleaner Overview control

- Removed the editable Winter-mode selector from the Overview.
- The Overview now contains only the global **Summer** and **Winter** buttons.
- The configured Winter target mode remains visible as read-only metadata next to the switch.
- This avoids accidental changes to the global Winter behavior from the day-to-day dashboard.

## Server-owned Winter behavior

- Activating Winter now sends only the requested global mode to the system API.
- The backend reads the persisted Winter target mode and applies that stored configuration to every compatible thermostat.
- A stale pre-v0.8.35 client may still send the old optional `winterMode` field for compatibility, but the backend ignores it when applying the global mode.
- Summer continues to set all compatible thermostats to `OFF`.
- The global heating mode remains a SALTA system control and is **not exposed to HomeKit**.

## Persistence and diagnostics

- Reuses the existing additive `climate_mode_settings` table; no schema migration is required.
- Added a dedicated persistence update for the Winter target mode that preserves the current global mode and last application result.
- Winter target-mode configuration changes are recorded in the SALTA system log without triggering thermostat commands.

## Regression coverage

- Added manager coverage proving that storing a Winter target mode does not send thermostat commands.
- Updated Winter-mode command tests so the applied mode is read from persisted configuration.
- Added server API coverage proving that the Settings endpoint only stores configuration while the system endpoint performs the actual mode application.
- Updated frontend coverage for the read-only Overview value, dedicated Settings selector and explicit apply action.
- Added explicit rate-limit coverage for the new climate Settings routes.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- Existing Summer/Winter state and configured Winter mode are preserved.
- Existing HomeKit, Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, FRITZ!Box Presence, battery-warning, Pushover, virtual-device and automation functionality remains compatible.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.35.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains patched `fast-uri` `3.1.5` and `4.1.2`.
- Retains PostCSS `8.5.23`.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.35
0.8
latest
```

## Git tag

```text
v0.8.35
```
