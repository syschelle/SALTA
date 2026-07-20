# SALTA v0.4.0

SALTA 0.4.0 introduces the first real hardware integration: Shelly devices can now be discovered, added, monitored and controlled directly from the SALTA dashboard.

## Highlights

- Add Shelly devices manually by IP address or hostname.
- Scan a user-supplied `/24` network for Shelly devices.
- Automatic detection of Shelly Gen1 REST and Gen2/Gen3/Gen4 RPC devices.
- Support for global credentials, per-device credentials, and devices without authentication.
- Read and periodically refresh device status.
- Control switches, lights and covers from the dashboard.
- Read power and energy values when provided by the device.
- Assign newly added devices to rooms.
- Display model, generation, host and online state.

## Supported capabilities

- Switch: on, off and toggle
- Light: on, off, toggle and brightness
- Cover: open, close, stop and target position
- Energy meter: power and energy status

## Security

Shelly passwords remain encrypted using `SALTA_ENCRYPTION_KEY` and are never returned by the REST API.

## Notes

Network discovery requires SALTA to be able to reach the target LAN. Docker deployments should use a network configuration that permits access to Shelly device IP addresses.
