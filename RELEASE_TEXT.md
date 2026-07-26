# SALTA v0.7.8

SALTA v0.7.8 adds operating-mode control for HomeMatic heating thermostats and wall thermostats.

## HomeMatic thermostat modes

- Added **Off**, **Manual** and **Automatic** buttons to supported thermostat cards.
- Added support for classic HomeMatic devices that expose `AUTO_MODE` and `MANU_MODE` actions.
- Added support for Homematic IP devices that expose a writable mode enum such as `SET_POINT_MODE`.
- Uses the OpenCCU VALUES parameter description to determine write access, native JSON-RPC value types and enum values.
- Uses a device's native off mode when one is available.
- Falls back to manual mode at the minimum frost-protection temperature when the device has no separate off mode.
- Restores a practical target temperature when switching from Off to Manual and the current setpoint is still at the minimum.
- Displays the active mode directly on the thermostat card.

## Quality and compatibility

- Added mapping tests for classic HomeMatic heating thermostats.
- Added mapping tests for Homematic IP wall thermostats.
- Added frontend and command-path regression coverage.
- Kept the `find-my-way` 9.7.0 security pin introduced in v0.7.7.
- No database migration is required.
- No environment-variable changes are required.
- Existing OpenCCU, Shelly, Zigbee, HomeKit and PostgreSQL configuration remains compatible.

## Updating

```bash
./update.sh
```

For a new installation:

```bash
./install.sh
```

After updating, open the HomeMatic page and run **Synchronize** once so SALTA refreshes the writable parameter descriptions for the thermostat channels.

## Verification

```bash
npm ci --no-audit --no-fund
npm run check
npm ls find-my-way --all
```

The dependency tree must continue to contain only:

```text
find-my-way@9.7.0
```

## Container tags

```text
0.7.8
0.7
latest
```

## Git tag

```text
v0.7.8
```
