# SALTA v0.4.1

This maintenance release removes all built-in demonstration devices from SALTA.

## Fixed

- Removed the mock adapter and all automatically generated demo devices.
- Existing devices with the `mock` source are automatically deleted during database migration.
- Removed the mock adapter from the health, readiness, adapter and reconciliation APIs.
- Synchronization now refreshes Shelly devices only.
- HomeKit commands are routed directly to the Shelly adapter.
- Removed the obsolete `MOCK_EVENT_INTERVAL_MS` setting.

## Upgrade notes

No manual database cleanup is required. When SALTA starts after the upgrade, previously stored demonstration devices are removed automatically. Real Shelly devices, rooms and settings remain unchanged.
