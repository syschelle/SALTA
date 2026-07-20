# Changelog

## 0.4.4

- Corrected Shelly component priority so covers and lights are not misclassified as switches.
- Added outlet detection for Shelly plugs and support for standalone EM, EM1 and PM1 energy meters.
- Added current power, energy, voltage, current, frequency and temperature parsing across Gen1 and RPC devices.
- Aggregated multi-channel and multi-phase energy meter values.
- Persisted generation, firmware, hostname, MAC address, component, channel and capability metadata.
- Fixed database upserts so corrected device types and source metadata are applied to existing records.
- Updated dashboard value formatting and total current-power calculation.
- Added seven automated Shelly parser tests.

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
