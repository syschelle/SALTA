# SALTA v0.7.11

SALTA v0.7.11 turns the overview page into a live, room-based control dashboard.

## Room-based overview

- Removed the static **STATUS / Alles an einem Ort** panel from the overview page.
- Added all room-assigned Shelly, Zigbee and HomeMatic devices directly to the overview.
- Groups devices by room in the exact order configured on the Rooms page.
- Omits devices without a valid room assignment so the overview remains focused on the configured home layout.
- Shows the source system on each mixed overview card: Shelly, Zigbee or HomeMatic.

## Device control

The overview uses the same live device cards as the dedicated adapter pages. Depending on device capabilities, the following controls remain available directly from the overview:

- On/off switching
- Light brightness
- Window-covering position and open/stop/close commands
- Thermostat target temperature
- HomeMatic thermostat modes: Off, Manual and Automatic
- Device configuration

Device states continue to refresh automatically with the existing live-refresh interval.

## Regression coverage

- Added checks that the overview device grid exists and is rendered during normal and live data refreshes.
- Added checks that only devices with valid room assignments are included.
- Added checks that room order is preserved.
- Added checks that the old status panel and its text are no longer present.
- Added checks for source labels on mixed device cards.

## Security and compatibility

- Retains `find-my-way` 9.7.0.
- Retains the internally consistent `@homebridge/dbus-native` 0.7.7 lock entry.
- No database migration is required.
- No environment-variable changes are required.
- Existing Shelly, Zigbee, OpenCCU, HomeKit and PostgreSQL configuration remains compatible.

## Verification

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm ls @homebridge/dbus-native find-my-way --all
npm run check
```

## Container tags

```text
0.7.11
0.7
latest
```

## Git tag

```text
v0.7.11
```
