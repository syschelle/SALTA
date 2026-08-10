# SALTA v0.8.23

SALTA v0.8.23 makes the automation rule overview substantially more compact and fixes the rule summary so all OR-linked trigger devices are visible instead of only the first device being shown.

## Complete OR-trigger summaries

- Automation cards now include every configured `WHEN` / OR trigger in the rule summary.
- Additional trigger devices are no longer hidden behind a generic `x triggers (OR)` counter.
- Button events from the same device are grouped into one compact device entry.
- Multiple events on the same button device remain visible, for example `Single click / Double click`.
- Different trigger devices are separated by an explicit `OR` marker.
- Boolean-state triggers continue to show their state and expected value.
- The stored automation format and execution semantics are unchanged; this is a presentation fix for the existing trigger data.

## More compact automation cards

- Reduced card padding, vertical gaps and icon sizes in the automation overview.
- Moved the last-event timestamp into the compact metadata row next to the active state and room badge.
- Moved Edit and Delete into small icon actions in the card header.
- Removed the separate `No additional condition` row when a rule has no condition.
- A condition row is rendered only when the automation actually has an additional condition.
- Trigger summaries use compact wrapping chips, allowing multiple devices to remain readable without forcing a tall card.
- Reduced the spacing between automation cards.
- Added responsive behavior for the compact trigger layout on narrow screens.

## Regression coverage

- Added a runtime frontend regression test proving that trigger events from the same device are grouped while different OR-trigger devices remain visible.
- Added frontend checks for the compact card controls and trigger list.
- Extended release validation so a future release cannot silently revert to showing only the primary trigger device.
- Extended release validation so the redundant empty-condition row and the old large-card layout are not reintroduced accidentally.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No automation API or persistence format is changed.
- Existing automation rules and OR triggers remain compatible.
- Existing FRITZ!Box Presence, Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device and HomeKit functionality remains unchanged.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.23.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains the patched `fast-uri` dependency versions introduced in v0.8.21.
- Retains PostCSS `8.5.23` in the development dependency tree.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.23
0.8
latest
```

## Git tag

```text
v0.8.23
```
