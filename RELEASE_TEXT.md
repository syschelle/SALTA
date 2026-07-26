# SALTA v0.7.10

SALTA v0.7.10 makes the HomeMatic thermostat control mode shown in the web interface directly writable, including devices for which OpenCCU exposes the current mode but omits the writable mode parameter from its parameter description.

## HomeMatic thermostat control

- Shows the **Off**, **Manual** and **Automatic** controls whenever SALTA can display a thermostat's current control mode and the target temperature is writable.
- Uses explicit writable mode metadata from OpenCCU whenever it is available.
- Adds a safe device-family fallback when OpenCCU only exposes the read-only `CONTROL_MODE` value.
- Uses `AUTO_MODE` and `MANU_MODE` for classic HomeMatic radiator and wall thermostats.
- Uses `SET_POINT_MODE` with `0` for automatic and `1` for manual on Homematic IP thermostats.
- Keeps the existing frost-protection fallback for **Off** when a device has no dedicated off mode.
- Allows already synchronized v0.7.9 thermostat records to use the inferred control path immediately, while the next synchronization persists the complete capability metadata.

## Regression coverage

- Added classic HomeMatic wall-thermostat coverage where only `CONTROL_MODE` is described.
- Added Homematic IP wall-thermostat coverage where only `CONTROL_MODE` is described.
- Added command-plan tests for inferred `AUTO_MODE`, `MANU_MODE` and `SET_POINT_MODE` writes.
- Added frontend coverage ensuring the controls are rendered for an already displayed OpenCCU control mode.

## Security and compatibility

- Retains `find-my-way` 9.7.0.
- Retains the internally consistent `@homebridge/dbus-native` 0.7.7 lock entry.
- No database migration is required.
- No environment-variable changes are required.
- Existing OpenCCU, Shelly, Zigbee, HomeKit and PostgreSQL configuration remains compatible.

## Verification

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm ls @homebridge/dbus-native find-my-way --all
npm run check
```

After deployment, open the HomeMatic page and run **Synchronize** once. Thermostats that already show a control mode should then display working **Off**, **Manual** and **Automatic** buttons.

## Container tags

```text
0.7.10
0.7
latest
```

## Git tag

```text
v0.7.10
```
