# SALTA v0.7.5

SALTA v0.7.5 fixes OpenCCU device-name display and enables reliable HomeMatic controls, including thermostat target temperatures.

## OpenCCU device names

- Reads the ReGa device IDs through `Device.listAll`, resolves each configured physical HomeMatic device through `Device.get`, and joins the returned address and name to the RPC catalogue
- Uses the physical OpenCCU device name as the card title instead of a technical channel label or model/serial fallback
- Displays a distinct channel name as secondary metadata when it helps identify a channel of a multi-channel device
- Replaces existing source-managed fallback names during the next full synchronization
- Continues to preserve names deliberately edited locally in SALTA

## HomeMatic control

- Loads the OpenCCU VALUES parameter description for synchronized channels
- Uses the parameter write flags to expose controls only for writable values
- Uses native OpenCCU JSON-RPC value types such as `bool` and `float` instead of guessed `boolean` and `double` types
- Keeps on/off control for compatible switches, relays and plugs
- Keeps brightness control for compatible dimmers
- Keeps position and stop control for compatible window coverings
- Adds target-temperature control for compatible classic HomeMatic and HomeMatic IP radiator and wall thermostats
- Keeps contact, motion, weather and other pure sensor channels read-only

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
0.7.5
0.7
latest
```

## Git tag

```text
v0.7.5
```
