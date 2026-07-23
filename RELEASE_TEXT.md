# SALTA v0.6.0

SALTA v0.6.0 adds the first native Phoscon/deCONZ integration and separates Shelly and Zigbee devices throughout the web interface.

## Phoscon connection

- Added configuration for one local Phoscon/deCONZ gateway under Settings
- Supports an existing deCONZ REST API key or guided app pairing
- Requests an API key after third-party app authentication is temporarily enabled in Phoscon
- Encrypts the stored API key with the existing `SALTA_ENCRYPTION_KEY`
- Shows gateway connection state, software/API information, Zigbee channel and synchronization errors
- Supports manual synchronization and clean disconnection without deleting devices from Phoscon

## Zigbee devices

- Renamed the former Devices navigation entry to Shelly
- Added a separate Zigbee page with its own room filter, search and synchronization action
- Imports supported lights, on/off actuators, smart plugs, window coverings and sensor resources
- Supports motion, contact, temperature, humidity, light, water, smoke, button, power and energy data
- Groups multiple deCONZ sensor resources belonging to the same physical Zigbee device into one SALTA card
- Merges metering and battery resources into a matching single actuator when the physical device can be identified unambiguously
- Keeps Zigbee device identifiers stable when the gateway address changes but the deCONZ bridge identity remains the same

## Zigbee control

- Added on, off and toggle commands for supported Zigbee lights and plugs
- Added 0–100 percent brightness control for dimmable lights
- Added open, close, stop and target-position commands for compatible window coverings
- Keeps sensor-only resources read-only
- Stores SALTA display names and room assignments locally without changing the Phoscon device configuration

## Reliability and security

- Added periodic Phoscon synchronization with unreachable-device handling
- Added explicit API errors for invalid URLs, rejected API keys, locked pairing windows, timeouts and unreachable gateways
- Added Phoscon credential validation to application readiness checks
- Added dedicated rate limits for Phoscon pairing and reconciliation
- Added adapter, API and frontend regression tests

## Compatibility

- No database schema migration is required
- No new `.env` variable is required
- Existing Shelly devices, rooms and settings remain unchanged
- No fresh installation is required when updating from an existing SALTA installation

## Updating

```bash
./update.sh
```

For a new installation:

```bash
./install.sh
```

## Container tags

```text
0.6.0
0.6
latest
```

## Git tag

```text
v0.6.0
```
