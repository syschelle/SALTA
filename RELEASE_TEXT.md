# SALTA v0.8.24

SALTA v0.8.24 makes the top of the main Overview page more compact and adds household Presence directly to the dashboard summary.

## More compact Overview header

- Reduced the visual height of the Overview header while keeping the existing SALTA title, subtitle and manual synchronization action.
- Reduced the Overview title, eyebrow and synchronization-button sizing specifically on the dashboard without changing the typography of the other SALTA pages.
- Tightened the spacing between the Overview header, summary cards and the room/device section.
- Reduced the summary-card padding, corner radius and number sizing so the most important dashboard information consumes less vertical space.
- Shortened the room-section helper text while preserving its meaning.

## Presence in the dashboard summary

- Added a fifth Overview summary card named **Presence** / `Anwesenheit`.
- The card reuses SALTA's existing virtual `presence:house` / `presence-group` device; no second presence calculation or polling path is introduced.
- When at least one configured person is present, the card shows `Zuhause` and highlights the status in green.
- When nobody is present, the card shows `Niemand`.
- The detail line shows the current count, for example `1 von 2 anwesend`.
- If Presence has not been configured yet, the card remains neutral and shows `nicht eingerichtet`.
- Presence devices remain excluded from the normal device, reachable-device and power counters, so the existing Overview metrics keep their previous meaning.

## Responsive layout

- The desktop dashboard uses five compact summary cards in one row when enough width is available.
- The summary automatically drops to three columns on narrower desktop/tablet widths.
- On small screens the summary uses two columns and the Presence card spans the full row for better readability.
- Existing compact device cards and room grouping remain unchanged.

## Regression coverage

- Added dedicated frontend regression coverage for the compact Overview header and five-card summary.
- Added checks that the Presence summary is sourced from the existing `presence:house` / `presence-group` device.
- Added checks that Presence devices stay excluded from the existing device/reachability/power counters.
- Extended release validation so the compact Overview layout and Presence summary cannot disappear silently in a future release.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No API or Presence persistence format is changed.
- Existing FRITZ!Box Presence targets and automations remain compatible.
- Existing Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device, automation and HomeKit functionality remains unchanged.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.24.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains the patched `fast-uri` dependency versions introduced in v0.8.21.
- Retains PostCSS `8.5.23` in the development dependency tree.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.24
0.8
latest
```

## Git tag

```text
v0.8.24
```
