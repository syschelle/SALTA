# SALTA v0.8.38

SALTA v0.8.38 adds a compact Daylight status card to the Overview so the current solar phase, sunrise and sunset are visible beside the global heating and battery controls.

## Daylight Overview card

- Added a compact **Tageslicht** card directly to the left of the global heating-mode card.
- Uses the existing Phoscon/deCONZ virtual `Daylight` sensor already synchronized into the SALTA device registry.
- Shows the current solar phase, for example `Morgendämmerung`, `Sonnenaufgang beendet`, `Sonnenhöchststand` or `Nachtbeginn`.
- Shows whether the sensor currently reports daylight or darkness.
- Shows the current day's **Sonnenaufgang** and **Sonnenuntergang** times.
- Uses the existing Daylight state fields `daylightStatus`, `daylight`, `dark`, `sunrise` and `sunset`; no additional polling endpoint is introduced.
- Displays a compact unavailable state when no Phoscon Daylight sensor can be found.
- The card is refreshed automatically with the normal five-second live device refresh.

## Overview layout

- Reworked the compact system-control row into a responsive three-card layout:
  - Daylight
  - Heating mode
  - Battery status
- Keeps the heating mode as the primary control while giving Daylight enough width for sunrise/sunset information.
- At narrower desktop widths the battery card moves to its own row, and on small screens all cards stack vertically.
- Reuses the existing SALTA card typography, icon containers, borders, spacing and responsive behavior.

## Regression coverage

- Extended the existing frontend system-control test instead of adding a duplicate test suite.
- Verifies that the Daylight card is placed before the heating card.
- Verifies the stable `daylightOverviewStatus` UI contract.
- Uses the TypeScript AST source inspector to verify the Daylight rendering functions and helper calls instead of exact full-function or object-literal source comparisons.
- Existing Phoscon adapter tests continue to cover mapping of Daylight, sunrise, sunset and solar phase values.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No new backend API is required.
- No HomeKit accessory is created for the Overview Daylight card.
- Existing HomeKit, Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, FRITZ!Box Presence, climate-mode, battery-warning, Pushover, virtual-device and automation functionality remains unchanged.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.38.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains patched `fast-uri` `3.1.5` and `4.1.2`.
- Retains PostCSS `8.5.23`.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.38
0.8
latest
```

## Git tag

```text
v0.8.38
```
