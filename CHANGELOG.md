# Changelog

All notable changes to SALTA are documented in this file.

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
