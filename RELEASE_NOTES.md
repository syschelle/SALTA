# SALTA v0.4.10

SALTA v0.4.10 corrects power-meter capability detection for the Gen1 Shelly 1 (`SHSW-1`).

## Fixed

- The Shelly 1 is no longer reported as having a physical power meter.
- Its configurable nominal load value is no longer displayed as a live watt measurement.
- Misleading `0 W` values are removed from the device card and dashboard total.
- Shelly 1PM (`SHSW-PM`) continues to expose its real power and energy readings.

## Background

The classic Shelly 1 does not contain measurement hardware. Its Gen1 API exposes a `meters[0].power` value that represents a manually configured appliance power constant while the relay is on. SALTA previously interpreted this value as a real-time measurement.

## Compatibility

No database migration is required. Existing Shelly 1 devices are corrected automatically during the next status synchronization.

## Quality assurance

The release passes TypeScript strict checking, 26 automated tests, frontend JavaScript syntax validation and the production build.
