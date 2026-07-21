# Changelog

All notable changes to SALTA are documented in this file.

## 0.4.8

- Added an inline, accessible error panel inside the Shelly add-device dialog so failures are no longer hidden behind the modal.
- Added clear user-facing messages for unreachable devices, authentication failures, detection timeouts, unsupported responses and invalid credentials.
- Preserved structured API error codes, HTTP status and request IDs in the frontend API client.
- Added stable backend error mapping and logging for Shelly onboarding failures.
- Added validation requiring a username when custom Shelly credentials are selected.
- Prevented optional integration listener failures from aborting successful device persistence.
- Added integration coverage proving that a deleted Shelly can be added again with the same device ID.
- Added API tests for successful onboarding and structured add-device errors.

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
