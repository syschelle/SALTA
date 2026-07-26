# SALTA v0.7.13

SALTA v0.7.13 fixes the room-grouped overview so devices with a valid room assignment are displayed reliably while unassigned devices remain excluded.

## Fixed

- Fixed an issue where the overview could remain empty even though devices had already been assigned to rooms.
- Replaced the strict direct UUID comparison with a centralized room-assignment resolver.
- Normalizes room IDs before matching, preventing harmless formatting differences from hiding assigned devices.
- Added a compatibility fallback for legacy records and adapter refreshes where the configured room name is available but the room UUID is missing or stale.
- The room-name fallback is used only when the name identifies exactly one configured room.
- Devices with no room assignment, an unknown room, or an ambiguous room name are never displayed on the overview.
- Room groups continue to follow the order configured on the Rooms page.
- Shelly, Zigbee and HomeMatic devices continue to appear together inside their assigned room.

## Reliability

- Added a dedicated browser-side room-grouping helper with behavior-based tests.
- Added regression coverage for:
  - normal room UUID assignments;
  - normalized UUID matching;
  - legacy room-name assignments;
  - stale room references with a valid unique room name;
  - unassigned devices;
  - unknown rooms; and
  - ambiguous duplicate room names.
- Added explicit initialization for the overview device container instead of relying on implicit browser globals.
- Fixed stale frontend assets after upgrades: SALTA-owned HTML, JavaScript and CSS now use `Cache-Control: no-store`.
- Bundled versioned vendor assets remain safely cached as immutable resources.
- Release validation now verifies that the room-grouping helper is loaded before the main application script.
- `npm run check` now syntax-checks both browser JavaScript files.

## Compatibility

- No database migration is required.
- No new environment variables are required.
- Existing room assignments remain compatible.
- Existing Shelly, Zigbee, OpenCCU, HomeKit and PostgreSQL configurations remain compatible.
- Retains the `find-my-way` 9.7.0 security update.
- Retains the corrected `@homebridge/dbus-native` 0.7.7 dependency lock.

## Upgrade note

After upgrading from v0.7.12 or earlier, perform one hard reload in the browser (`Ctrl+F5`). Older SALTA releases may still have cached the previous `app.js` for up to one hour. SALTA v0.7.13 prevents this problem across future upgrades. The overview displays only devices that resolve to a valid configured room. Devices without a valid room assignment remain available on their adapter pages but are not shown on the overview.

## Verification

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
sh -n install.sh update.sh backup.sh restore.sh
```

## Container tags

```text
0.7.13
0.7
latest
```

## Git tag

```text
v0.7.13
```
