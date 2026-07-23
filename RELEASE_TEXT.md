# SALTA v0.6.3

SALTA v0.6.3 fixes the frontend test-suite failure introduced when persistent Zigbee visibility was added in v0.6.2.

## Build and test fix

- Updated the device name and presentation regression tests to match the current shared device configuration request
- Validates the common `name`, `roomId` and `presentationType` configuration object before it is serialized
- Keeps the Zigbee-only `hidden` property as a conditional extension of that shared configuration object
- Preserves all Zigbee visibility, grey-card rendering and HomeKit-exclusion behavior from v0.6.2

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
0.6.3
0.6
latest
```

## Git tag

```text
v0.6.3
```
