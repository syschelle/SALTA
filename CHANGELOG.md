# Changelog

All notable changes to SALTA are documented in this file.

## 0.5.6

- Expanded `docker-compose.image.yml` into a complete standalone production deployment.
- Included PostgreSQL, SALTA, volumes, networks, health checks, security options, port mappings and all required environment variables in the single file.
- Updated installation, update, backup, restore and production documentation commands to use only `docker-compose.image.yml`.
- Added regression coverage that verifies the production Compose file is self-contained.
- Kept the database schema and application runtime behavior unchanged.

## 0.5.5

- Fixed backup and restore scripts so `.env` values containing spaces are no longer executed as shell code.
- Added registry hydration that loads persisted devices without rewriting them at every startup.
- Cleared in-memory room assignments immediately after a room is deleted.
- Removed legacy automatic room creation from device persistence.
- Removed unreachable thermostat and motion-sensor presentation paths.
- Removed unused exports, metadata keywords and the redundant direct Pino dependency.
- Enabled TypeScript unused-local and unused-parameter checks and excluded test sources from the production build output.
- Marked the package as private and removed the duplicate release-notes file.

## 0.5.4

- Corrected the security documentation to match the implemented v0.5 behavior.
- Clarified that SALTA does not terminate TLS and that direct LAN HTTP traffic is unencrypted.
- Documented the exact `TRUSTED_PROXIES`, HTTPS detection, Secure-cookie and HSTS behavior.
- Documented that direct Basic authentication is limited to `LOCAL_NETWORKS`, rejected through forwarded proxy requests and should be protected by HTTPS.
- Clarified that application rate limits, sessions and login blocks are stored in process memory and reset on restart.
- Corrected the Docker description of `/tmp` to writable, size-limited `tmpfs` with `noexec` and `nosuid`; the container root filesystem is not read-only.
- Added narrower local-network guidance and security-control limitations without changing runtime behavior or the database schema.

## 0.5.3

- Fixed the Shelly onboarding dialog closing after an upstream device authentication failure.
- Redirected to the SALTA login page only for the explicit `UNAUTHORIZED` session error.
- Returned Shelly credential failures as HTTP 422 instead of HTTP 401.
- Kept authentication errors visible inside the open onboarding dialog.
- Added frontend and API regression coverage for the corrected authentication paths.
- Kept the v0.5 database schema and installation configuration unchanged.

## 0.5.2

- Restored the complete Material Design Icons (MDI) attribution in `README.md`.
- Added the upstream Pictogrammers attribution required by the frontend regression test.
- Retained the Apache License 2.0 notice and local bundled-license reference.
- Kept runtime behavior, APIs and the v0.5 database schema unchanged.

## 0.5.1

- Fixed the npm lockfile after the v0.5.0 dependency cleanup removed two still-required nested packages.
- Restored `fast-uri@4.1.1` for `fast-json-stringify`.
- Restored `process-warning@4.0.1` for `light-my-request`.
- Restored registry URL and integrity metadata for `@fastify/rate-limit@10.3.0`.
- Kept the v0.5 clean-install architecture and runtime behavior unchanged.

## 0.5.0

- Introduced a clean-install-only database schema generation with explicit schema metadata.
- Added one-step installation with `./install.sh`, database reset with `--reset` and complete reinstall with `--fresh`.
- Added automatic generation of PostgreSQL, administrator, health-token and encryption secrets.
- Removed incremental SQL migrations, the duplicate room-name column and old room synchronization logic.
- Removed v1 credential decryption and automatic credential conversion.
- Removed compatibility mutation logic from `update.sh`, the old `deploy.sh` workflow and the obsolete v0.3 roadmap.
- Replaced the direct static-file plugin with an allow-listed native handler and removed its obsolete `glob` dependency chain.
- Added regression tests for mandatory Compose variables, fresh installation, static assets and the canonical v0.5 schema.
- Documented the remaining deprecated transitive `q` package inherited from the upstream HomeKit persistence dependency.
- Updated Compose, environment examples and documentation for clean v0.5 installations.

## 0.4.33

- Changed the SALTA source-code license from MIT to Apache License 2.0.
- Updated `LICENSE`, package metadata and README licensing information consistently.
- Removed version-tag publishing instructions from the main README.
- Added release documentation and Git commands for v0.4.33.
- Added no runtime, database or configuration changes.

## 0.4.32

- Added `@fastify/rate-limit` and explicit per-route limits for all six database- or authentication-backed endpoints reported by CodeQL.
- Retained the existing SALTA global, client, mutation and specialized rate limits as defense in depth.
- Replaced the Digest challenge regular expression with a linear character-by-character parser.
- Added regression coverage for route rate-limit configuration and Digest challenge parsing.

## 0.4.31

- Updated the persistent-theme regression test for the CSP-compatible external `theme-init.js` script.
- Verified that theme initialization runs before the first stylesheet is loaded.
- Kept runtime behavior and security policy unchanged.

## 0.4.30

- Republished the unchanged v0.4.29 application and security hardening under a new release tag.
- Added no runtime, database or configuration changes.
- Intended to trigger a fresh GitHub container build when the previous workflow run cannot be rerun.

## 0.4.29

- Fixed TypeScript compilation of the authenticated Fastify injection test helper.
- Replaced overload-derived `undefined` options with `light-my-request` `InjectOptions`.
- Added `light-my-request` as an explicit development dependency.
- Kept the v0.4.28 security behavior unchanged.

## 0.4.28

- Added mandatory browser authentication with a dedicated login page and server-side sessions.
- Added HttpOnly SameSite=Strict cookies, CSRF validation, logout and finite session lifetimes.
- Restricted direct HTTP Basic API access to configured local networks.
- Protected health and readiness endpoints and added a secret Docker-only health check.
- Added login, per-client, mutation, expensive-route and global request limits with security logging.
- Added CSP and additional browser security headers, body/header limits and connection timeouts.
- Moved PostgreSQL to an internal Docker network and removed its published host port.
- Added Docker capability, PID and temporary-filesystem restrictions for SALTA.
- Added automated security, session, CSRF, local-network and frontend authentication coverage.
- Added `SECURITY.md` and reverse-proxy trust guidance.

## 0.4.26

- Updated the compact device-card regression test to match the current 11 px/10 px measurement spacing.
- Restored successful CI and release builds after the v0.4.25 layout adjustment.
- No runtime or database behavior changed.

## 0.4.25

- Moved the device name into the top row beside the device icon.
- Kept the room/type metadata directly below the title inside the same compact header block.
- Reduced top whitespace in device cards.
- Added frontend regression coverage for the compact device-title layout.

## 0.4.24

- Extended colored state-card styling to outlet devices such as Shelly Plug S (`SHPLG-S`).
- Softened the outer state-card border colors so the right edge is less visually heavy.
- Removed the redundant On/Off status metric from colored outlet cards.
- Added frontend regression coverage for outlet state coloring.

## 0.4.23

- Added green and red card-state colors for reachable switch and light devices.
- Removed the redundant On/Off status metric from colored switch and light cards.
- Kept the compact device-card layout and compact measurement presentation.
- Added frontend regression coverage for state-color card styling.

## 0.4.22

- Grouped the device overview by room.
- Applied the persistent room order from the Rooms page to device groups and room selectors.
- Added accessible up/down controls for arranging rooms.
- Added a transactional room-order API and normalized stored sort positions.
- Replaced the device-card Configure text button with a compact gear-only button.
- Kept unassigned devices in a final dedicated group.
- Added API and frontend regression coverage for grouping, ordering and the icon-only configuration action.

## 0.4.21

- Reduced padding and vertical spacing inside device cards.
- Prevented short cards from stretching to the height of the tallest card in the same grid row.
- Compacted measurement rows, action buttons and cover-position controls.
- Added frontend regression coverage for compact card layout.

## 0.4.20

- Replaced free-text room icon entry with a curated visual icon selector.
- Added common room choices such as living room, bedroom, kitchen, bathroom, office, garage and garden.
- Added live icon previews for new and existing rooms.
- Synchronized renamed room names into every assigned device in memory and PostgreSQL.
- Added frontend, registry and API regression coverage for room icon selection and room-name synchronization.

## 0.4.19

- Removed hover elevation and shadow transitions from device cards.
- Added subtle hover and active feedback to buttons and button-style links only.
- Added frontend regression coverage to keep device cards visually stable during live refreshes.

## 0.4.18

- Replaced custom and Unicode interface symbols with locally bundled Material Design Icons.
- Added local MDI webfont assets without external CDN requests.
- Added MDI device, navigation, theme, action and room icons.
- Documented the Pictogrammers source and Apache License 2.0 attribution.
- Added frontend regression coverage for local icon loading and licensing.

## 0.4.17

- Added a configurable logical device function for compatible on/off Shelly devices.
- Added Automatic, Light, Switch, Outlet and Fan presentation options to the shared device configuration dialog.
- Kept physical Shelly detection and command routing separate from user-selected dashboard and HomeKit presentation.
- Added HomeKit `Lightbulb`, `Switch`, `Outlet` and `Fanv2` service mappings.
- Added automatic HomeKit service rebuilding when a device function changes.
- Persisted the selected function through the automatic `presentation_type` database schema extension.
- Preserved configured functions during Shelly status refreshes and repeated onboarding.
- Rejected incompatible presentation assignments for non-switchable devices.
- Added automated frontend, API, adapter, persistence and HomeKit regression coverage.

## 0.4.16

- Added a live light/dark theme switch to the sidebar.
- Added a complete dark palette for dashboards, device cards, dialogs, forms, navigation and mobile controls.
- Persisted the selected appearance in the functional `salta_theme` cookie for one year.
- Applied the saved theme before the stylesheet renders to prevent a visible light-theme flash.
- Updated the browser theme color and native control color scheme when the theme changes.
- Added accessible labels, pressed state and reduced-motion handling for the theme control.
- Added automated frontend regression coverage for theme persistence and dark-mode styling.

## 0.4.15

- Added a 0–100 percent position slider to calibrated window-covering device cards.
- Added immediate position previews and percentage feedback while dragging the slider.
- Preserved active slider interaction during the five-second live-status refresh.
- Added discrete Open, Stop and Close actions for window coverings.
- Displayed clear calibration guidance when a Shelly cannot report a current position.
- Added adapter-side validation for cover target positions.
- Added automated frontend and adapter regression coverage for position control.

## 0.4.14

- Added active `switch` and `cover` profile detection for Shelly 2PM-class devices.
- Added `Shelly.GetConfig` retrieval for component configuration and channel names.
- Registered every switch component as an independent SALTA device in switch profile.
- Registered one unified window-covering device in cover profile.
- Routed live state refreshes and commands to the matching component ID.
- Persisted the detected device profile through an automatic database schema extension.
- Preserved existing primary-device names and room assignments when a multi-channel device is added again without replacement values.
- Added channel metadata to device cards and channel-aware onboarding feedback.
- Added regression coverage for two-channel onboarding, cover onboarding and second-channel commands.

## 0.4.13

- Improved Gen2, Gen3 and Gen4 onboarding through the public `/shelly` identity endpoint.
- Changed parameterless RPC status detection to a compatible HTTP GET request.
- Added a JSON-RPC frame fallback for firmware that rejects method-specific GET endpoints.
- Added RFC 7616 Digest authentication with SHA-256 support for protected Gen2+ devices.
- Preserved Basic authentication support for Gen1 devices.
- Prevented a confirmed Gen2+ device from being misreported as an unsupported Gen1 endpoint after a status-call failure.
- Added detailed rejected-onboarding errors to the structured server log.
- Added Shelly Plus 2PM regression coverage for two switch channels, Digest authentication and RPC fallback behavior.

## 0.4.11

- Fixed room-name editing being cancelled by the five-second live refresh.
- Separated live device polling from the full rooms and filters refresh.
- Preserved active room edit drafts, focus and text selection during intentional full page-data refreshes.
- Added frontend regression coverage for room editing and live polling.

## 0.4.10

- Corrected Gen1 Shelly 1 (`SHSW-1`) capability detection.
- Stopped treating the Shelly 1 user-configured nominal load as a live power measurement.
- Marked `SHSW-1` devices as not supporting hardware power metering.
- Kept real Shelly 1PM (`SHSW-PM`) power and energy measurements unchanged.
- Removed misleading `0 W` values from Shelly 1 device cards and the dashboard power total.
- Added automated regression coverage for Shelly 1 and Shelly 1PM Gen1 status parsing.

## 0.4.9

- Added startup and readiness validation for encrypted global and per-device Shelly credentials.
- Added a clear `ENCRYPTION_KEY_MISMATCH` API response instead of exposing a generic persistence error.
- Disabled the global-credentials onboarding option when stored credentials cannot be decrypted and displayed a corrective warning in the web interface.
- Upgraded new credential encryption to AES-256-GCM with a per-secret random salt and a `scrypt`-derived key.
- Added backward-compatible decryption and automatic re-encryption of valid legacy v1 secrets.
- Updated `deploy.sh` to generate a random 256-bit `SALTA_ENCRYPTION_KEY` for new installations.
- Preferred dedicated `PM1`/`EM1` measurement components over stale zero values from switch components.
- Added fallback support when a device exposes a single metering component with a different component ID.
- Added automated tests for encryption compatibility, key mismatch handling and power-meter selection.

## 0.4.7

- Added a device removal action to the Shelly device configuration dialog.
- Added `DELETE /api/devices/:id` for persistent Shelly device removal.
- Device removal now deletes associated command history through the existing database cascade.
- Removed devices are immediately detached from the in-memory registry and HomeKit bridge.
- Added race protection so an active Shelly status refresh cannot recreate a device while it is being removed.
- Added automated tests for persistent removal, stale refresh protection and deliberate re-adding.

## 0.4.6

- Added `docker-compose.image.yml` as the single production image override.
- Removed the architecture-specific `docker-compose.arm64.yml` and `docker-compose.amd64.yml` files.
- Relied on the GHCR multi-architecture manifest for automatic host architecture selection.
- Updated deploy, update, backup and restore scripts to use the unified image Compose configuration.
- Updated README, GHCR documentation, release notes and release commands for v0.4.6.

## 0.4.5

- Corrected Shelly device type detection for covers, lights, outlets, switches and dedicated energy meters.
- Prioritized cover and light components before generic switch components during RPC detection.
- Added outlet classification for Shelly Plug, Plug S and PowerStrip model families.
- Added support for separate `PM1`, `EM1` and `EM` measurement components.
- Added aggregation of multi-channel and multi-phase power and energy values.
- Displayed current power, energy, voltage, current, frequency and temperature values with appropriate units.
- Prevented unavailable measurements from being displayed as artificial zero values.
- Updated persisted device types during status synchronization when improved detection returns a different type.
- Rebuilt HomeKit accessories with the correct service after a detected device type change.
- Used detected Shelly component kinds and IDs for RPC control commands.
- Added automated parser tests for Gen1 and Gen2+ device detection and live values.
- Updated release documentation and GHCR publishing instructions for v0.4.5.

## 0.4.2

- Redesigned the Shelly onboarding dialog with clearly separated connection and authentication sections.
- Replaced the crowded authentication dropdown with descriptive radio choices and conditional credential fields.
- Added responsive, consistent dialog layouts for Shelly onboarding and device configuration.
- Improved network discovery feedback and disabled action buttons while requests are running.
- Added clearer helper text, spacing, focus behavior and accessible tab state.

## 0.4.1

- Removed the mock adapter and built-in demonstration devices.
- Added automatic cleanup of previously persisted mock devices.
- Removed mock-specific configuration and API endpoints.
- Updated HomeKit and synchronization routing to use Shelly only.

## 0.4.0

- Added Shelly discovery, manual device onboarding and device control foundations.
- Added support for Shelly Gen1 REST and Gen2/Gen3/Gen4 RPC devices.
