# SALTA v0.7.18

SALTA v0.7.18 adds a direct shortcut from every Shelly device card to the Shelly device's own local web interface while retaining the virtual-device, compact-card and hardened build functionality from the previous releases.

## Shelly device web shortcut

- Added a compact **Open device web interface** icon directly next to the configuration icon on Shelly device cards.
- The shortcut is available wherever the common Shelly device card is rendered, including:
  - the Shelly page; and
  - the room-based overview for room-assigned Shelly devices.
- Clicking the icon opens the Shelly device's local web interface in a new browser tab.
- SALTA derives the destination from the stored Shelly host address, so no additional configuration is required.
- The shortcut is shown only for devices whose source is `shelly` and which have a valid device address.
- Zigbee, HomeMatic and SALTA-native virtual devices do not receive the shortcut.
- Device URLs are restricted to HTTP or HTTPS and URLs containing embedded credentials are rejected.
- New tabs are opened with `noopener,noreferrer` so the Shelly page cannot access the SALTA window through `window.opener`.
- If a Shelly has no usable address, SALTA does not render the shortcut.

## User interface

- The new Shelly web shortcut uses the locally bundled Material Design Icons asset and requires no external icon service.
- The shortcut uses the compact `open-in-new` icon and matches the size of the configuration button.
- The existing configuration button remains unchanged and continues to open the SALTA device configuration dialog.
- The additional shortcut does not add a separate action row, preserving the compact device-card layout on desktop and mobile devices.

## Build and regression protection

- Added dedicated frontend regression tests for the Shelly web shortcut.
- Tests verify that the shortcut is rendered through the shared device-card component.
- Tests verify that the shortcut is limited to Shelly devices.
- Tests verify HTTP/HTTPS URL validation and rejection of embedded URL credentials.
- Tests verify isolated new-tab behavior using `noopener,noreferrer`.
- Tests verify that the shortcut keeps the same compact dimensions as the configuration button.
- Release validation now checks that the Shelly web shortcut and its safe new-tab behavior remain present.

## Test-symbol preflight retained from v0.7.17

- `npm run test:preflight` continues to inspect all test sources before Vitest starts.
- Test files remain covered by the dedicated `tsconfig.tests.json` configuration even though production compilation excludes `*.test.ts`.
- Unresolved identifiers such as `TS2304` and `TS2552` fail the quality gate before runtime tests execute.
- The complete `npm run check` quality gate remains part of CI and the Docker build.

## Virtual devices retained from v0.7.16

- The **Virtual Devices** section remains directly after **HomeMatic** in the navigation.
- SALTA-native virtual switches can be created, renamed, assigned to rooms, switched and deleted.
- Room-assigned virtual switches appear in the room-based overview.
- Unassigned virtual switches remain on the Virtual Devices page and are intentionally excluded from the overview.
- Virtual switches remain automatically available through the SALTA HomeKit bridge when HomeKit is enabled.
- SALTA and HomeKit continue to use the shared source-aware device command router.
- Virtual-device persistence continues to use the existing PostgreSQL-backed device registry without a database migration.

## Compact device cards retained from v0.7.14

- Device cards retain reduced padding, smaller headers and compact measurement chips.
- The configuration button remains in the card header.
- Read-only sensors do not receive an unnecessary empty action row.
- Dimmer, thermostat and window-covering controls remain grouped in the compact control area.
- Thermostat operating modes remain directly available:
  - Off
  - Manual
  - Automatic
- Device grids remain adaptive on desktop and tablet layouts.
- Smartphone views retain the single-column device layout and compact two-by-two overview statistics.

## Room overview behavior retained

- Devices continue to be grouped by their assigned room.
- Shelly, Zigbee, HomeMatic and virtual devices can appear together in the same room.
- Room ordering follows the Rooms configuration page.
- Devices without a valid room assignment remain excluded from the overview.
- Unassigned devices remain available on their respective adapter or Virtual Devices page.
- SALTA-owned HTML, JavaScript and CSS continue to use no-store caching to prevent stale frontend assets after upgrades.

## Security and dependency status

- Retains `find-my-way` 9.7.0 with the HTTP/2 denial-of-service fix.
- Retains the corrected `@homebridge/dbus-native` 0.7.7 lock entry and integrity checksum.
- No production npm dependency was added or changed in v0.7.18.
- The transitive dependency lock remains unchanged from v0.7.17 apart from the SALTA root version.

## Compatibility

- No database migration is required.
- No new environment variables are required.
- No API changes are required.
- Existing device, room, adapter and HomeKit configurations remain compatible.
- Existing Shelly credentials and device addresses remain unchanged.

## Verification

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run validate:release
npm run typecheck
npm run test:preflight
npm test
npm run build
npm run check
sh -n install.sh update.sh backup.sh restore.sh
```

## Container tags

```text
0.7.18
0.7
latest
```

## Git tag

```text
v0.7.18
```
