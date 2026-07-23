# SALTA v0.6.2

SALTA v0.6.2 separates Shelly-only credentials from Zigbee device settings and adds persistent visibility controls for Phoscon devices.

## Zigbee device settings

- Corrected the device dialog so the Shelly authentication section is not displayed for Zigbee devices
- Added a local “Hide device” setting for every synchronized Zigbee device
- Keeps hidden devices visible as grey cards on the Zigbee page with an explicit hidden status badge
- Allows hidden devices to be restored at any time from the same device dialog
- Stores the visibility preference locally in SALTA without modifying the device in Phoscon
- Preserves the visibility choice during periodic synchronization and after reconnecting the gateway

## HomeKit behavior

- Excludes hidden devices from HomeKit synchronization
- Removes an existing HomeKit accessory immediately when its SALTA device is hidden or HomeKit export is disabled
- Keeps the hidden-device exclusion in place for future Zigbee HomeKit support

## Persistence

- Added an additive `device_preferences` table for local per-device visibility settings
- Creates the table automatically during normal startup
- Requires no database reset, manual migration or new environment variable
- Removes the preference automatically when the associated SALTA device is deleted

## Compatibility

- No fresh installation is required
- No existing Shelly or Zigbee device must be re-added
- No Phoscon pairing change is required
- No Docker Compose or `.env` change is required

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
0.6.2
0.6
latest
```

## Git tag

```text
v0.6.2
```
