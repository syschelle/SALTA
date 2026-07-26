# SALTA v0.7.6

SALTA v0.7.6 fixes the frontend regression-test failure introduced with HomeMatic thermostat target-temperature controls.

## Build and test fix

- Updated the window-covering slider regression test to match the current shared live-refresh guard
- Verifies that active cover, brightness and target-temperature sliders prevent periodic device-card re-rendering
- Preserves the thermostat control and OpenCCU behavior introduced in v0.7.5

## Runtime behavior

- No application runtime behavior changed
- No API behavior changed
- No database schema changed
- No Docker Compose or `.env` change is required
- No fresh installation is required

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
0.7.6
0.7
latest
```

## Git tag

```text
v0.7.6
```
