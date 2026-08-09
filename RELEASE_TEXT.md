# SALTA v0.7.17

SALTA v0.7.17 fixes the GitHub build failure in the virtual-device server tests and closes the underlying quality-gate gap that allowed unresolved identifiers in `*.test.ts` files to reach Vitest at runtime.

## Build fix

- Fixed `src/server.test.ts` by importing the mocked `listRooms` database helper before it is used by the virtual-switch creation test.
- Fixed the failing test `virtual devices > creates a virtual switch with an optional SALTA room assignment`.
- The virtual-switch runtime implementation itself was not changed by this fix.

## Test-symbol preflight

- Added a dedicated `tsconfig.tests.json` that includes the test sources intentionally excluded from the production TypeScript build.
- Added `npm run test:preflight` before Vitest in the complete SALTA quality gate.
- The preflight asks TypeScript to inspect all source and test files and fails specifically on unresolved identifiers such as:
  - `TS2304: Cannot find name ...`
  - `TS2552: Cannot find name ... Did you mean ...`
- This catches missing test imports before the affected test reaches runtime.
- Release validation now verifies that the test-symbol preflight remains present in `npm run check` and that test files cannot silently be excluded from this check.

## Virtual devices retained from v0.7.16

- Added a new **Virtual Devices** section directly after **HomeMatic** in the main navigation.
- Added the same entry to the responsive mobile navigation.
- Virtual devices are SALTA-native and do not require a physical host, credentials or an external adapter.
- The initial supported type is **Switch**.
- Virtual switches can be:
  - created from the SALTA web interface;
  - assigned to an existing SALTA room;
  - left unassigned when required;
  - switched on and off from SALTA;
  - renamed later;
  - moved to another room; and
  - deleted again from SALTA.
- Virtual switches use the same compact device cards as physical devices.
- A room-assigned virtual switch automatically appears in the room-based overview together with Shelly, Zigbee and HomeMatic devices.
- An unassigned virtual switch remains available on the **Virtual Devices** page but is intentionally excluded from the room-based overview.

## HomeKit synchronization retained from v0.7.16

- Virtual switches are automatically marked for HomeKit export.
- When the SALTA HomeKit bridge is enabled, each virtual switch is published as a HomeKit switch accessory.
- SALTA and HomeKit use a shared source-aware device command router.
- Switching a virtual device from SALTA updates the persisted state and the running HomeKit accessory.
- Switching it from HomeKit uses the same command path and updates the SALTA device state.
- Deleting a virtual switch removes it from the SALTA registry and from the running HomeKit bridge.
- Existing persisted virtual switches are restored automatically after a SALTA restart and are republished to HomeKit.

## Persistence and API retained from v0.7.16

- Virtual switches are persisted through the existing PostgreSQL-backed SALTA device registry.
- No additional database table or schema migration is required.
- The virtual-device creation endpoint remains rate limited.
- Existing device configuration and command endpoints are reused for rename, room assignment and switching.
- The common delete endpoint supports SALTA-native virtual devices in addition to removable Shelly devices.
- System-log entries identify virtual-device creation through the `virtual` source.

## Command routing retained from v0.7.16

- The shared `DeviceCommandRouter` dispatches commands according to the persisted device source.
- The HomeKit bridge does not depend directly on the Shelly adapter for writes.
- Virtual devices therefore have a first-class HomeKit command path while adapter routing remains centralized.

## Compact device cards retained from v0.7.14

- Reduced card padding, header spacing, icon sizes and control spacing.
- Device names and metadata use a compact single-line layout with safe ellipsis for long model or channel names.
- Live measurements are displayed as small, responsive value chips.
- Dimmer, thermostat and window-covering controls remain grouped into a compact control area.
- Thermostat operating modes remain directly available:
  - Off
  - Manual
  - Automatic
- Switch, light, outlet and roller-shutter actions remain directly available.
- The configuration button remains in the device-card header.
- Read-only sensors do not receive an empty action row.
- Device grids adapt automatically to the available width.
- Smartphone views use a clear single-column device layout.
- The four overview statistics use a compact two-by-two grid on smartphones.

## Room overview behavior retained

- Devices continue to be grouped by their assigned room.
- Shelly, Zigbee, HomeMatic and room-assigned virtual devices can appear together in the same room.
- Room ordering follows the Rooms configuration page.
- Devices without a valid room assignment remain excluded from the overview.
- Unassigned devices remain available on their respective adapter or Virtual Devices page.
- SALTA application-owned HTML, JavaScript and CSS continue to use no-store caching to prevent stale frontend assets after upgrades.

## Build reliability retained from v0.7.15

- CSS tests understand base rules and responsive media-query overrides instead of inspecting only the final matching rule.
- OpenCCU frontend tests follow composed renderer call graphs instead of requiring obsolete direct function calls.
- Release validation rejects the previously fragile frontend test patterns.
- The Docker build and GitHub workflows continue to use the complete SALTA quality gate.
- Safe versioning continues to update only SALTA root version fields and known release surfaces.

## Security and dependency status

- Retains `find-my-way` 9.7.0 with the HTTP/2 denial-of-service fix.
- Retains the corrected `@homebridge/dbus-native` 0.7.7 lock entry and integrity checksum.
- No production npm dependency was changed in v0.7.17.
- The transitive dependency lock remains unchanged from v0.7.16 apart from the SALTA root version.

## Compatibility

- No database migration is required.
- No new environment variables are required.
- No API or runtime behavior changes are required for existing devices.
- Existing Shelly, Zigbee, OpenCCU, room and device configurations remain compatible.
- Existing HomeKit configuration remains compatible.
- Existing virtual switches remain compatible and are restored after restart as before.

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
0.7.17
0.7
latest
```

## Git tag

```text
v0.7.17
```
