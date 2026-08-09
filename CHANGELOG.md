# Changelog

All notable changes to SALTA are documented in this file.

## 0.8.3

- Added searchable trigger, condition and target device selectors to the Automations editor.
- Device search matches names, rooms, adapter/source labels, models and logical device types.
- Added match counts and deterministic room/name sorting so large installations are easier to navigate.
- Widened the automation editor on large screens while keeping the existing single-column responsive layout on smaller screens.
- Added regression coverage for all three searchable selectors without changing automation-engine behavior or npm dependencies.

## 0.8.2

- Removed the CI dependency on a standalone `vitest.config.ts` bootstrap file.
- `npm test` now runs through the existing test-symbol preflight runner, which supplies deterministic test-only configuration before launching the locked local Vitest executable.
- Preserved the database-independent automation core and injected PostgreSQL persistence introduced in v0.8.1.
- Added release checks that prevent the test runner from depending on optional Vitest root configuration files.
- Retained the v0.8.0 automation engine, optional device condition, and On/Off/Toggle target actions unchanged.


## 0.8.1

- Fixed the GitHub CI collection failure where the automation unit test imported `db.ts` and triggered production environment validation before Vitest could run.
- Separated the automation core from PostgreSQL persistence and system logging through injected `AutomationStore` and `AutomationLogger` interfaces.
- Added a production `automation-persistence.ts` adapter and explicit dependency injection from `main.ts`.
- Added a centralized Vitest setup for mandatory test-only application configuration values.
- Explicitly excluded the Vitest-only setup from the production TypeScript build.
- Added regression and release validation so the automation core cannot silently regain a direct database/configuration dependency.
- Retained the complete automation trigger, optional condition, On/Off/Toggle action, persistence and loop-protection functionality from v0.8.0.
- Kept the npm dependency tree unchanged from v0.8.0 apart from the SALTA root version.

## 0.8.0

- Introduced the first persistent local automation engine and re-baselined the roadmap so v0.8.x represents the automation milestone.
- Added an Automations page for device-state triggers, one optional device-state condition and On/Off/Toggle actions.
- Added transition detection so repeated adapter polling does not retrigger unchanged states.
- Added cross-adapter actions through the shared device command router, including Shelly, Zigbee, HomeMatic and virtual devices.
- Added rule enable/disable, edit, delete, last-run reporting and automation system-log entries.
- Added cyclic automation graph rejection and active-rule re-entry protection.
- Added an additive PostgreSQL `automations` table with foreign-key cleanup for deleted devices.
- Added authenticated, rate-limited automation CRUD endpoints and regression coverage for engine behavior, UI structure and schema persistence.
- Kept the npm dependency tree unchanged from v0.7.18 apart from the SALTA root version.

## 0.7.18

- Added a compact Shelly web-interface shortcut next to the configuration button on Shelly device cards.
- The shortcut opens the stored Shelly host in a separate browser tab and is available on both the Shelly page and room overview.
- Restricted generated device links to HTTP/HTTPS, rejected embedded URL credentials, and isolated the new tab with `noopener,noreferrer`.
- Added dedicated frontend regression tests and release validation for the Shelly-only shortcut and compact button layout.
- No database migration, environment-variable change or production dependency update is required.


## 0.7.17

- Fixed the virtual-device server test by importing the mocked `listRooms` database helper before use.
- Added a dedicated TypeScript test-symbol preflight that scans all test sources for unresolved identifiers before Vitest starts.
- Added `tsconfig.tests.json` so test files are included in the preflight even though production compilation intentionally excludes `*.test.ts`.
- Added release validation that requires the test-symbol preflight to remain part of `npm run check`.
- Retained all virtual-switch, HomeKit, compact-card, room-overview, security and dependency fixes from v0.7.16.


## 0.7.16

- Added a new **Virtual Devices** navigation section directly after HomeMatic.
- Added persistent SALTA-native virtual switches with create, rename, room assignment, control and delete workflows.
- Virtual switch state is stored through the existing PostgreSQL-backed device registry.
- Virtual switches are automatically exposed through the SALTA HomeKit bridge when HomeKit is enabled.
- Added a shared device command router so SALTA and HomeKit use the same source-aware command path.
- Added virtual-device API, UI and HomeKit regression coverage without changing the database schema.
- Retained the compact responsive device-card layout and hardened build tests from v0.7.14 and v0.7.15.

## 0.7.15

- Fixed five false-negative build tests introduced with the compact device-card layout.
- Replaced last-rule-only CSS assertions with shared rule inspection that recognizes both desktop declarations and later mobile media-query overrides.
- Added transitive TypeScript-AST call-graph inspection so OpenCCU tests follow `deviceCard` through the shared `deviceControls` renderer to thermostat controls.
- Added regression tests for override-aware CSS inspection, composed renderer calls and cyclic helper graphs.
- Extended release validation to prevent the obsolete test patterns from returning.
- Retained every compact and responsive device-card change from v0.7.14 without changing runtime behavior.
- No database migration or environment-variable change is required.

## 0.7.14

- Redesigned device cards with denser spacing, smaller headers and compact measurement chips.
- Moved the configure action into the card header so read-only sensor cards no longer render an otherwise empty bottom action row.
- Grouped dimmer, thermostat and window-covering controls in a compact control section while preserving all existing actions.
- Changed device grids to an adaptive layout that uses available desktop and tablet width more efficiently.
- Added a dedicated mobile layout with single-column device cards, reduced padding and a compact two-by-two summary grid.
- Kept the room-grouped overview behavior unchanged: only devices with a valid room assignment are displayed.
- Added AST and responsive-layout regression coverage for control composition, configuration placement and empty-action suppression.
- No database migration or environment-variable change is required.

## 0.7.13

- Fixed the overview page so devices with valid room assignments are reliably displayed in their configured room.
- Added normalized room-ID matching to handle UUID formatting differences safely.
- Added a unique room-name fallback for legacy device records and adapter refreshes that retain a room name without a usable room UUID.
- Kept devices without a valid, unambiguous room assignment completely hidden from the overview page.
- Added a dedicated browser room-grouping helper with behavior-based regression tests for assigned, legacy, stale, ambiguous and unassigned devices.
- Added explicit overview DOM initialization and release validation that guarantees the grouping helper loads before the main application script.
- Disabled browser caching for SALTA-owned HTML, JavaScript and CSS assets so a new page can no longer run with an older cached application script after an upgrade; immutable bundled vendor assets remain long-lived.
- Extended the complete quality gate to syntax-check both browser scripts.
- No database migration or environment-variable change is required.

## 0.7.12

- Fixed the false-negative OpenCCU frontend test that still required the obsolete exact call `targetTemperatureControl(d)` after the renderer added an instance argument for duplicate-ID protection.
- Replaced critical exact frontend call-string assertions with TypeScript-AST source contracts that validate function existence and call relationships independently of formatting and additional compatible arguments.
- Added a release validator for root-version consistency, public npm registry URLs, pinned security overrides, and the Homebridge DBus tarball checksum.
- Added a safe `npm run version:set -- <version>` command that updates only SALTA root version fields and known release surfaces without modifying transitive dependency versions or integrity values.
- Expanded `npm run check` to include release validation and browser JavaScript syntax validation.
- Changed the Docker build to run the complete quality gate instead of only compiling TypeScript.
- Added an explicit verification job to the release workflow before QEMU and multi-architecture image publication.
- No application runtime behavior, database schema, environment variable, device integration, room overview, or thermostat control behavior changed.

## 0.7.11

- Replaced the overview page's static **STATUS / Alles an einem Ort** panel with live device cards grouped by room.
- Shows all Shelly, Zigbee and HomeMatic devices that have a valid room assignment.
- Preserves the room order configured on the Rooms page and omits unassigned or stale room references from the overview.
- Keeps device controls, live values, thermostat modes, dimmers and window-covering controls available directly on the overview cards.
- Displays the source system on mixed overview cards so Shelly, Zigbee and HomeMatic devices remain distinguishable.
- Added frontend regression coverage for overview grouping, removal of the old status panel and live rendering integration.
- No database migration or environment-variable change is required.

## 0.7.10

- Made an already displayed HomeMatic thermostat control mode directly writable in the web interface.
- Added a safe fallback for OpenCCU installations that expose read-only `CONTROL_MODE` but omit the writable mode parameter from `getParamsetDescription`.
- Uses native `AUTO_MODE` / `MANU_MODE` actions for classic HomeMatic thermostats and `SET_POINT_MODE` values 0 / 1 for Homematic IP thermostats.
- Allows existing synchronized thermostat records to use the inferred command path immediately and persists complete metadata after synchronization.
- Added runtime and regression coverage for classic HomeMatic and Homematic IP wall thermostats.
- Retained the `find-my-way` 9.7.0 security fix and the corrected `@homebridge/dbus-native` 0.7.7 lock entry.
- No database migration or environment-variable change is required.

## 0.7.9

- Fixed the reproducible `npm ci` build failure caused by mismatched `@homebridge/dbus-native` version and integrity metadata in `package-lock.json`.
- Restored the upstream `@homebridge/dbus-native` 0.7.7 package record, tarball URL and matching SHA-512 integrity value.
- Added an exact npm override for `@homebridge/dbus-native` 0.7.7 so future lockfile refreshes cannot accidentally select the problematic 0.7.8 record.
- Added regression coverage that verifies the dependency version, resolved tarball, integrity checksum and `@homebridge/hap-nodejs` dependency declaration remain consistent.
- Retained the HomeMatic thermostat mode controls introduced in v0.7.8 and the `find-my-way` 9.7.0 security fix.
- No database migration or environment-variable change is required.

## 0.7.8

- Added HomeMatic thermostat operating-mode controls for **Off**, **Manual** and **Automatic**.
- Supports classic HomeMatic thermostats and wall thermostats exposing `AUTO_MODE` / `MANU_MODE` actions.
- Supports Homematic IP thermostats and wall thermostats exposing a writable mode enum such as `SET_POINT_MODE`.
- Uses OpenCCU parameter descriptions to select the correct native value type and mode values instead of relying on device-model hardcoding.
- Implements **Off** through a native off mode when available, otherwise through manual mode at the device's minimum frost-protection temperature.
- Added active-state mode buttons to HomeMatic thermostat cards and regression coverage for both thermostat families.
- No database migration or environment-variable change is required.

## 0.7.7

- Updated the transitive Fastify router dependency `find-my-way` from 9.6.0 to 9.7.0.
- Fixed CVE-2026-47219 / GHSA-c96f-x56v-gq3h, a remotely triggerable denial-of-service condition when `find-my-way` is used with Node.js HTTP/2.
- Added an exact npm override so `npm ci` and Docker builds reproducibly install the patched router release.
- Added regression coverage that rejects vulnerable `find-my-way` versions in `package-lock.json`.
- Kept application behavior, APIs, database schema, environment variables and device integrations unchanged.

## 0.7.6

- Updated the window-covering slider regression test for the shared live-refresh guard introduced with thermostat target-temperature control.
- Verifies that active cover, brightness and target-temperature sliders are all protected from periodic device-card re-rendering.
- Keeps runtime behavior, OpenCCU control, database schema and deployment configuration unchanged.

## 0.7.5

- Reads ReGa device IDs through `Device.listAll`, resolves each physical device through `Device.get`, and joins its configured name to the RPC catalogue by address.
- Keeps distinct OpenCCU channel names as secondary card metadata for multi-channel devices.
- Refreshes VALUES parameter descriptions to identify writable parameters and their native JSON-RPC value types.
- Corrected HomeMatic command value types from guessed `boolean`/`double` values to the OpenCCU-compatible `bool`/`float` types.
- Added target-temperature control for compatible classic HomeMatic and HomeMatic IP radiator and wall thermostats.
- Continues to keep contact, motion and other pure sensor channels read-only.
- Added regression coverage for physical device names, thermostat mapping, control metadata and frontend temperature controls.

## 0.7.4

- Added automatic OpenCCU recovery after gateway restarts and temporary network outages.
- Invalidates stale local JSON-RPC sessions after transport, catalogue or complete channel-read failures and creates a fresh session on the next retry.
- Retries disconnected OpenCCU gateways every 15 seconds while keeping the normal connected polling interval at 60 seconds.
- Refreshes the OpenCCU device catalogue after reconnecting so current device and channel names are loaded again.
- Reads names from `Device.listAllDetail` from both array and keyed-object response shapes and decodes URL-encoded names.
- Replaces legacy generated names such as `HM-Sec-SCo NEQ1157537:1` with the configured OpenCCU name.
- Continues to preserve names that were deliberately edited locally in SALTA.
- Reduced the error-501 automatic retry delay to one minute while retaining serialized, single-session access.
- Added regression coverage for gateway restart recovery, legacy-name replacement and locally customized names.

## 0.7.0

- Added a native OpenCCU/HomeMatic JSON-RPC integration.
- Added separate HomeMatic navigation, filtering and device cards.
- Added encrypted OpenCCU account configuration under Settings.
- Added periodic synchronization for BidCos-RF, BidCos-Wired, HmIP-RF and VirtualDevices.
- Added control for compatible switches, dimmers and window coverings plus read-only sensor mapping.
- Added additive OpenCCU settings and per-device adapter metadata storage.
- Added OpenCCU core, persistence, frontend and API regression coverage.

## 0.6.3

- Fixed two frontend regression tests that still expected the pre-visibility device configuration payload.
- Updated the assertions to validate the shared configuration object and its serialized request body.
- Preserved the Zigbee `hidden` preference added conditionally for Phoscon devices.
- Kept application runtime behavior, APIs, database schema and deployment configuration unchanged.

## 0.6.2

- Hid Shelly-only credential controls correctly in Zigbee device dialogs.
- Added a persistent local visibility setting for Zigbee devices.
- Kept hidden Zigbee devices visible as grey cards with an explicit status badge.
- Excluded hidden devices from HomeKit synchronization, including dynamic removal of an existing accessory.
- Added an additive `device_preferences` table that is created automatically without a database reset.
- Preserved visibility choices across Phoscon synchronization and gateway reconnects.
- Added API, persistence, HomeKit and frontend regression coverage.

## 0.6.1

- Fixed the Phoscon adapter test suite importing the production database configuration during module collection.
- Moved URL normalization, REST response parsing and Zigbee device mapping into a configuration-free Phoscon core module.
- Kept database persistence and runtime polling isolated in the production adapter.
- Added regression coverage through imports that no longer require `DATABASE_URL`, administrator credentials or SALTA secrets.
- Kept Phoscon behavior, APIs, database schema and deployment configuration unchanged.

## 0.6.0

- Added a local Phoscon/deCONZ REST API integration with encrypted API-key storage.
- Added guided Phoscon app pairing after enabling gateway authorization.
- Split the former Devices navigation into dedicated Shelly and Zigbee pages.
- Added Zigbee light, outlet, covering, sensor and metering discovery and synchronization.
- Combined multiple deCONZ sensor resources belonging to one physical Zigbee device.
- Merged unambiguous metering and battery sensor resources into their matching actuator card.
- Added control for supported Zigbee on/off devices, dimmable lights and window coverings.
- Added Phoscon connection state, manual synchronization and disconnect controls.
- Extended credential-readiness validation and rate limiting to the Phoscon adapter.
- Added adapter, API and frontend regression coverage.

## 0.5.7

- Added practical hardware guidance for a dedicated SALTA-only host.
- Recommended a Raspberry Pi 4 with 4 GB RAM and SSD storage while documenting lower practical minimums.
- Made installation, reset, update, backup and security wording in the README independent of a specific release line.
- Removed obsolete migration wording and hard-coded release references from the README.
- Kept application runtime behavior, APIs, database schema and deployment configuration unchanged.

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
