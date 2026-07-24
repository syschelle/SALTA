# SALTA v0.7.0

SALTA v0.7.0 adds the first native OpenCCU/HomeMatic integration and introduces a separate HomeMatic area in the web interface.

## OpenCCU connection

- Added configuration for one local OpenCCU instance under Settings
- Connects through the CCU-compatible JSON-RPC endpoint at `/api/homematic.cgi`
- Stores the OpenCCU password encrypted with the existing `SALTA_ENCRYPTION_KEY`
- Tests the configured address and credentials before saving them
- Shows connection state, available interfaces, synchronized device count and the latest synchronization result
- Supports clean disconnection without modifying devices in OpenCCU

## HomeMatic devices

- Added a separate HomeMatic page with its own room filter, search and synchronization action
- Imports supported channels from BidCos-RF, BidCos-Wired, HmIP-RF and VirtualDevices
- Supports compatible switches, relays, plugs, dimmable lights and window coverings
- Imports contact, motion, temperature, humidity, light, water, smoke, power and energy data
- Keeps device names and room assignments local to SALTA
- Keeps OpenCCU devices excluded from HomeKit in this initial integration

## Control and synchronization

- Added on, off and toggle commands for compatible actuators
- Added 0–100 percent brightness control for compatible dimmers
- Added open, close, stop and target-position commands for compatible coverings
- Polls OpenCCU every 60 seconds and refreshes the device catalogue periodically
- Uses short-lived JSON-RPC sessions and logs out after each synchronization or command transaction
- Marks synchronized devices unreachable when OpenCCU cannot be contacted

## Security and persistence

- Added encrypted OpenCCU password storage
- Added additive `openccu_settings` and `device_adapter_data` tables
- Does not return the stored password to the browser
- Keeps TLS certificate validation enabled for HTTPS OpenCCU endpoints
- Added readiness reporting for the OpenCCU adapter and encrypted credential state

## Initial limitations

- No XML-RPC callback registration
- No OpenCCU program or system-variable management
- No device pairing or configuration changes
- No thermostat setpoint control
- No HomeKit export for OpenCCU devices in this release

## Compatibility

- No fresh installation is required
- No new `.env` variable is required
- Existing Shelly, Zigbee, room and Phoscon data remain unchanged
- The additive tables are created automatically during normal startup

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
0.7.0
0.7
latest
```

## Git tag

```text
v0.7.0
```
