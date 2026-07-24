# SALTA v0.7.1

SALTA v0.7.1 adds in-application OpenCCU diagnostics and a persistent system log while keeping user-facing connection errors visible.

## OpenCCU diagnostics

- Added a diagnostic action directly to the OpenCCU settings panel
- Reports every tested JSON-RPC method with its status, duration, interface and result count
- Shows the exact failed OpenCCU method and remote error message, including Tcl errors
- Keeps blocking connection errors visible in the settings panel instead of relying only on a short-lived notification
- Separates successful login and interface discovery from optional catalogue and device-name requests
- Treats `Device.listAllDetail` failures as warnings and continues without detailed OpenCCU names
- Treats a failed `Interface.listDevices` call as an interface-specific warning while continuing with other interfaces
- Preserves the visible error message as part of the normal application workflow

## System log

- Added a protected System Log page to the web interface
- Added filters for source and severity plus manual refresh and clear actions
- Records SALTA startup and shutdown events
- Records OpenCCU connection tests, diagnostic steps, synchronization results and failed JSON-RPC methods
- Stores the method name, interface, duration, result count and remote error details needed for troubleshooting
- Does not intentionally store passwords, API keys, encryption keys, cookies, CSRF tokens or OpenCCU session identifiers
- Retains entries for up to 30 days and caps the log at the newest 2,000 records

## Persistence and API

- Added an additive `system_logs` table created automatically during normal startup
- Added authenticated read and clear endpoints for the system log
- Added rate limiting for log access and OpenCCU diagnostic runs
- Added database, API, adapter and frontend regression coverage

## Compatibility

- No fresh installation is required
- No new `.env` variable is required
- Existing Shelly, Zigbee, HomeMatic, room and adapter data remain unchanged
- The additive log table is created automatically during normal startup

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
0.7.1
0.7
latest
```

## Git tag

```text
v0.7.1
```
