# SALTA v0.8.31

SALTA v0.8.31 adds two global household functions: a SALTA-only Summer/Winter heating mode for compatible thermostats and centralized battery warnings with rate-limited Pushover notifications.

## Global Summer / Winter heating mode

- Added a persistent **Summer / Winter** control directly to the SALTA Overview.
- The control is a SALTA system setting, not a virtual device, and is therefore **never exposed to HomeKit**.
- **Summer mode** sends `OFF` to every thermostat that supports SALTA thermostat-mode control.
- **Winter mode** can be configured to apply either:
  - `Handbetrieb` / manual mode
  - `Automatik` / automatic mode
- Changing the Winter target mode while Winter mode is active immediately reapplies the selected mode.
- SALTA reports how many thermostats were detected, how many support global mode control and how many commands succeeded or failed.
- Failed thermostat commands do not prevent the remaining thermostats from being processed.
- The last global mode application and its result are persisted.
- Current OpenCCU/HomeMatic thermostats with SALTA target-temperature/mode metadata are supported; the implementation is capability-based so future thermostat adapters can participate without changing the system-mode model.

## Central battery warnings

- Added a global battery monitor for every SALTA device that exposes either:
  - a numeric `battery` percentage, or
  - an explicit `lowBattery` state.
- The default percentage warning threshold is **20%** and can be configured in Settings.
- Explicit `lowBattery=true` always counts as a warning regardless of the configured percentage threshold.
- The Overview now shows whether battery warnings are currently active and lists the first affected devices.
- Settings show the complete current warning list.

## Pushover notifications

- Added a new **Benachrichtigungen** settings area for Pushover.
- Supports:
  - Pushover User Key
  - Application API Token
  - enable/disable switch
  - configurable battery threshold
  - test notification
- User Key and Application API Token are encrypted at rest with the existing `SALTA_ENCRYPTION_KEY`.
- Secret values are never returned by the settings API and are never written to the system log.
- SALTA sends one **aggregated** Pushover message containing all currently low-battery devices.
- Battery warnings use a strict **seven-day global cooldown**.
- Persistent notification state prevents container restarts from bypassing the weekly limit.
- Test notifications do not consume or reset the weekly battery-warning cooldown.
- Pushover requests use the official HTTPS Message API endpoint with normal-priority delivery.

## Shelly battery data

- Added parsing of the Gen2+ Shelly `devicepower:<id>` status component.
- When `DevicePower` exposes `battery.percent`, SALTA adds the percentage to the normal device state so it participates in the same central battery warning logic as Zigbee and HomeMatic devices.
- Existing Shelly switch, cover, metering and reachability behavior remains unchanged.

## Persistence

Added three additive canonical tables:

- `climate_mode_settings`
- `notification_settings`
- `notification_state`

No incremental `ALTER TABLE` migration is introduced. Existing PostgreSQL installations on the current schema version create the new tables automatically at startup.

## System log

- Global heating-mode changes are recorded as system events.
- Partial thermostat-mode failures are recorded with the affected device IDs and error codes.
- Successful Pushover battery warnings are recorded without credentials.
- Failed Pushover sends are recorded without User Keys or API Tokens.
- Added `Benachrichtigungen` as a System Log source filter.

## Regression coverage

- Added climate-mode tests for Summer `OFF`, Winter manual and Winter automatic commands.
- Added battery-warning tests for percentage thresholds and explicit Low Battery states.
- Added coverage proving a battery warning is aggregated and not resent before seven days.
- Added frontend coverage for the SALTA-only climate controls and Pushover settings.
- Added Shelly parser coverage for `DevicePower` battery percentage.
- Extended release validation to guard the climate controls, weekly cooldown, Pushover endpoint, encrypted notification fields and additive persistence tables.

## Compatibility

- No manual database migration is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No HomeKit accessory is created for the Summer/Winter mode.
- Existing per-device HomeKit publication settings remain unchanged.
- Existing Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, FRITZ!Box Presence, Daylight, virtual-device and automation functionality remains compatible.

## Security and dependencies

- Pushover credentials are encrypted with the existing AES-256-GCM SALTA secret-storage path.
- Pushover requests use a fixed HTTPS API endpoint; administrators cannot configure an arbitrary notification URL.
- No production or development npm dependency was added or intentionally changed in v0.8.31.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains patched `fast-uri` `3.1.5` and `4.1.2`.
- Retains PostCSS `8.5.23`.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.31
0.8
latest
```

## Git tag

```text
v0.8.31
```
