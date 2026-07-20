# Changelog

## [0.4.0]

### Added
- Existing rooms can be edited inline on the Rooms page.

### Fixed
- Replaced uneven Unicode navigation glyphs with aligned SVG icons.
- Corrected visible and health endpoint version reporting.


## 0.4.0

- Fixed inconsistent navigation indentation by reserving a fixed icon column.
- Added the installed SALTA version to the sidebar.
- Added an accessible hamburger button and off-canvas sidebar for smaller screens.
- Added backdrop, Escape-key closing and correct ARIA expanded state.

## 0.4.0

### Changed

- Converted Rooms from a modal dialog into a dedicated responsive page.
- Converted Settings and global Shelly credentials from a modal dialog into a dedicated responsive page.
- Separated Overview, Devices, Rooms and Settings into hash-routed application pages.
- Kept device-specific configuration in a focused device dialog.

### Fixed

- Navigation highlighting now follows the actual page on desktop and mobile.
- Direct links such as `#rooms` and `#settings` open the correct page.
- Room and Shelly forms now provide in-page feedback without reopening dialogs.

## 0.3.0-alpha.1

### Added
- First-class room model and REST API.
- Room management and room filtering in the web UI.
- Global Shelly credentials.
- Per-device credential inheritance, override and no-auth modes.
- AES-256-GCM secret encryption using `SALTA_ENCRYPTION_KEY`.

### Changed
- Devices use room identifiers while retaining a readable room name in API responses.
- Existing textual room values are migrated automatically.
- Dashboard values use readable labels and units.

### Security
- Credential APIs return only `passwordConfigured`, never stored passwords.

## 0.2.5

- Fixed inaccessible npm registry URLs in the lockfile.

## [0.4.0] - 2026-07-20

### Added
- Real Shelly adapter with Gen1 REST and RPC device detection.
- Manual device onboarding by IP address or hostname.
- User-initiated `/24` network discovery.
- Shelly status polling and online/offline detection.
- Switch, light, cover and energy capabilities.
- Dashboard onboarding flow with room and credential selection.
- Persistent host, model and generation metadata.

### Changed
- Device commands are routed to the correct adapter.
- Synchronization now refreshes both mock and Shelly devices.
- Application and health endpoint version updated to 0.4.0.
