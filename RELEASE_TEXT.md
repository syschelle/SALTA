# SALTA v0.8.26

SALTA v0.8.26 consolidates the application layout widths and upgrades the device configuration dialog into a clearer device-detail view with source-specific technical information.

## Consolidated layout widths

- Introduced shared layout width tokens for the sidebar, maximum page width, common panel gap, secondary page columns, settings content and dialog sizes.
- The main SALTA content width is now defined once and reused instead of being overridden later by the compact-device-card styles.
- Standard two-column pages now use one common secondary-column width.
- The Presence connection/house-status and Presence target/form layouts use the same secondary-column width as other two-column SALTA pages.
- The Automation editor keeps the larger form column it needs, but now uses the shared large-side-column token instead of a separate ad-hoc ratio.
- The Settings page now uses a single shared maximum content width.
- Standard, compact and device-detail dialogs now use named shared width tokens.
- Existing responsive breakpoints remain in place so layouts still collapse to one column where the content requires it.

## Improved device configuration dialog

- Reworked the device configuration dialog into a wider, structured detail view while retaining the established numbered-section design.
- Added a compact header summary with device source, resolved device type, room and current online/offline status.
- Visible sections are numbered dynamically, so hidden source-specific sections no longer leave duplicate or skipped section numbers.
- Increased the dialog content width to prevent long section headings such as Authentication from colliding visually with the form fields.
- Kept assignment, presentation, Zigbee visibility and Shelly credential editing behavior unchanged.
- Simplified the device removal area and aligned it with the same section grid as the rest of the dialog.

## Device information

- Added a new read-only **Device information** section to the configuration dialog.
- Shows common metadata when available, including:
  - Source
  - Physical device type and optional presentation override
  - Online/offline state
  - Room
  - Model
  - Firmware
  - Host/address and hostname
  - MAC/device address
  - Generation/profile/channel information
  - HomeKit export state
  - Capabilities
  - Last seen and last event timestamps
  - SALTA ID and source ID
- Added source-specific information for Shelly devices, including component and credential mode.
- Added Phoscon/Zigbee resource information and visibility state.
- Added OpenCCU/HomeMatic interface, channel address, channel type and source-provided device/channel names.
- Added virtual-device type information for SALTA virtual devices.
- Technical identifiers and addresses can be copied directly from the information grid.
- Shelly devices expose the existing **Open web interface** action from the detail view when a valid local device address is available.

## Responsive device details

- Technical information uses a compact two-column grid on larger screens.
- The information grid and configuration sections collapse to a single column on smaller screens.
- The device removal action also stacks cleanly on narrow displays.

## Regression coverage

- Added frontend regression coverage for the structured device-detail dialog, source-specific metadata and visible-section numbering.
- Added layout regression coverage for the shared width tokens and their reuse across the main page, common two-column layouts, Settings, Presence, Automations and dialogs.
- Extended release validation so the consolidated width tokens and device information view cannot silently disappear in a future release.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No device API or persistence format is changed.
- Existing device names, room assignments, presentation overrides, credentials, visibility settings and automations remain compatible.
- Existing FRITZ!Box Presence, Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device, automation and HomeKit functionality remains unchanged.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.26.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains the patched `fast-uri` dependency versions introduced in v0.8.21.
- Retains PostCSS `8.5.23` in the development dependency tree.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.26
0.8
latest
```

## Git tag

```text
v0.8.26
```
