# SALTA v0.7.3

SALTA v0.7.3 restores OpenCCU devices automatically after gateway restarts and improves HomeMatic device-name synchronization.

## Automatic OpenCCU reconnect

- Detects OpenCCU restarts, network interruptions and unusable channel responses
- Invalidates the stale local JSON-RPC session instead of continuing to reuse it
- Creates a fresh OpenCCU session automatically on the next retry
- Retries every 15 seconds while OpenCCU is offline and returns to the normal 60-second polling interval after recovery
- Refreshes the device catalogue immediately after reconnecting
- Marks devices reachable again without restarting the SALTA container
- Keeps OpenCCU operations serialized and continues to use only one runtime session
- Reduces the automatic retry delay after ambiguous OpenCCU error 501 from five minutes to one minute

## HomeMatic device names

- Reads device and channel names from `Device.listAllDetail`
- Supports both array and keyed-object OpenCCU response shapes
- Decodes URL-encoded and plus-separated OpenCCU names
- Simplifies generated channel names such as `Device name:1` to the device name where appropriate
- Replaces legacy SALTA fallback names such as `HM-Sec-SCo NEQ1157537:1` with the configured OpenCCU name
- Follows later OpenCCU renames while the SALTA name has not been edited locally
- Preserves deliberate local name changes made in SALTA

## Compatibility

- No database schema migration is required
- No new `.env` variable is required
- No fresh installation is required
- Existing Shelly, Zigbee, HomeMatic, room and adapter data remain unchanged

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
0.7.3
0.7
latest
```

## Git tag

```text
v0.7.3
```
