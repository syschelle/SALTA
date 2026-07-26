# SALTA v0.7.14

SALTA v0.7.14 introduces a substantially more compact and responsive device-card layout for the room-grouped overview and the individual adapter pages.

## Compact device cards

- Reduced card padding, header spacing, icon sizes and control spacing.
- Device names and metadata now use a compact single-line layout with safe ellipsis for long model or channel names.
- Live measurements are displayed as small, responsive value chips instead of widely spaced text blocks.
- Dimmer, thermostat and window-covering controls are grouped into one compact control area.
- Thermostat operating modes remain directly available:
  - Off
  - Manual
  - Automatic
- Switch, light, outlet and roller-shutter actions remain directly available.

## Cleaner card actions

- Moved the configuration button into the device-card header.
- Read-only sensors no longer receive an otherwise empty action row containing only the configuration button.
- Action rows are rendered only when the device provides an actual operating action.
- The configuration button remains available on every device card with an accessible label and tooltip.

## Responsive layout

- Device grids now adapt automatically to the available width instead of using a fixed three-column desktop layout.
- Wider desktop views can display more compact cards per row.
- Tablet layouts use the available width without stretching cards to match taller neighboring controls.
- Smartphone views use a clear single-column device layout.
- The four overview statistics use a compact two-by-two grid on smartphones.
- Mobile padding, room headings, value chips, buttons and sliders were reduced without removing controls.

## Overview behavior

- Devices continue to be grouped by their assigned room.
- Shelly, Zigbee and HomeMatic devices can continue to appear together in the same room.
- Room ordering continues to follow the Rooms configuration page.
- Devices without a valid room assignment remain excluded from the overview.
- Unassigned devices remain available on their respective adapter pages.

## Reliability

- Added source-structure tests for the compact control composition and configuration-button placement.
- Added regression coverage that prevents empty action rows from returning on sensor-only cards.
- Added responsive-layout checks for the adaptive desktop grid and mobile single-column layout.
- Retains the stale-asset cache protection introduced in v0.7.13.
- Retains the `find-my-way` 9.7.0 security update.
- Retains the corrected `@homebridge/dbus-native` 0.7.7 dependency lock.

## Compatibility

- No database migration is required.
- No new environment variables are required.
- No API or device-integration changes are required.
- Existing room assignments and device configurations remain compatible.
- Existing Shelly, Zigbee, OpenCCU, HomeKit and PostgreSQL configurations remain compatible.

## Verification

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
sh -n install.sh update.sh backup.sh restore.sh
```

## Container tags

```text
0.7.14
0.7
latest
```

## Git tag

```text
v0.7.14
```
