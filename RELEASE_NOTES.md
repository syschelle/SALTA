# SALTA v0.4.4

SALTA v0.4.4 corrects Shelly device classification and restores current state and measurement values in the dashboard.

## Fixed

- Cover and light components are detected before generic switch components.
- Shelly plugs and power strips are classified as outlets instead of generic switches.
- Dedicated EM, EM1 and PM1 components are recognized as energy meters.
- Multi-channel and multi-phase power values are aggregated correctly.
- Separate power-meter components are merged with their associated switch or light channel.
- Existing database records receive corrected device types during reconciliation.
- Missing measurements are no longer displayed as artificial zero values.
- Commands use the detected RPC component namespace and component ID.

## Improvements

- Current power, energy, voltage, current, frequency and temperature values include correct units in the dashboard.
- The overview power indicator includes metered switches, outlets, lights and energy meters.
- Shelly generation, firmware, hostname, MAC address, channel count and capability metadata are stored persistently.
- State reconciliation starts immediately and runs without overlapping polling cycles.
- Added parser tests for Gen1, Gen2, Gen3 and cover/energy scenarios.

## Database migration

The migration adds nullable Shelly metadata columns to the existing `devices` table. No manual migration steps are required.

## Compatibility

Existing devices and room assignments remain intact. After startup, SALTA reconciles registered Shelly devices and updates their detected type and current state automatically.
