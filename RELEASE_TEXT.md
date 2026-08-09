# SALTA v0.8.4

SALTA v0.8.4 fixes the GitHub CI regression in the Automations frontend tests and hardens responsive CSS testing so shared media queries can be refactored without creating false build failures. The searchable automation device selectors introduced in v0.8.3 and the complete v0.8.x automation engine remain unchanged.

## Build fix

- Fixed `src/frontend-automations.test.ts`, which incorrectly required `.automation-card` to be the first selector immediately after `@media(max-width:620px){`.
- The actual mobile CSS was valid and already contained the expected automation-card rules later inside the same shared media query.
- Replaced the brittle exact CSS substring assertion with media-query-aware structural CSS inspection.
- The test now verifies the actual behavior:
  - `.automation-list` is a grid;
  - `.automation-card` uses `padding: 11px` below 620 px; and
  - `.automation-card-actions` uses `justify-content: stretch` below 620 px.
- No runtime CSS or automation behavior had to be changed to fix this CI failure.

## Media-query-aware CSS regression helpers

- Extended the shared `style-inspection` test utility with `cssMediaBlocks()` and `cssMediaRuleContains()`.
- The helper locates the complete requested media-query block using balanced braces instead of assuming selector order.
- Quoted strings, escaped characters and CSS comments are handled while locating block boundaries.
- Added dedicated regression coverage proving that a selector can appear after unrelated rules inside the same media query and is still detected correctly.
- Added a negative assertion so the helper also proves that an incorrect declaration is not accepted.

## Release validation hardening

- Release validation now rejects test assertions that hard-code media-query/selector adjacency such as `toContain("@media...{.selector")`.
- The check applies across all `*.test.ts` files rather than only to the Automations test.
- Release validation requires the Automations frontend test to use the shared media-query-aware CSS helper.
- Release validation requires the shared CSS inspection helper to continue exposing the media-query inspection functions.
- Existing protections against fragile exact frontend function-call assertions and last-rule-only CSS checks remain active.

## Searchable automation device selectors retained from v0.8.3

- Trigger, optional condition and target device selectors remain searchable.
- Search continues to match:
  - device name;
  - assigned room;
  - source / integration such as Shelly, Zigbee, HomeMatic or Virtual;
  - model; and
  - logical SALTA device type.
- Multiple search terms can be combined.
- Match counts remain visible below each device selector.
- Device options remain sorted by room and then by device name.
- Existing selections remain preserved while the search text is refined.
- The wider desktop Automations editor and compact mobile layout remain unchanged.

## Automation engine retained from v0.8.0

SALTA continues to use the persistent local automation model:

**When → Only if (optional) → Then**

### Trigger

- Select a trigger device.
- Select a boolean state exposed by that device.
- Select the value that should fire the rule.
- Rules trigger only when the selected state changes into the configured value.
- Repeated polling with an unchanged value does not retrigger the rule.

### Optional condition

- One optional condition device can be selected.
- The condition device must be different from the trigger device.
- Select a boolean state and the required value.
- The condition is evaluated when the trigger fires.
- Physical condition devices must be reachable before the action is allowed to execute.

### Action

A compatible target device can execute:

- **On**
- **Off**
- **Toggle**

The target device must be different from the trigger device.

## Cross-system automations

- Triggers can originate from Shelly, Zigbee, HomeMatic or SALTA-native virtual devices.
- Conditions can reference another supported integration.
- Actions continue to use the shared `DeviceCommandRouter`.
- Cross-system rules such as Zigbee motion → HomeMatic condition → Shelly switch remain supported.
- SALTA/HomeKit virtual switches remain usable as automation targets where their capabilities match the selected action.

## Automation persistence and protection

- Automation rules remain persisted in PostgreSQL and restored after restart.
- Create, edit, enable, disable and delete workflows remain available in the web interface.
- Last successful execution time remains visible.
- Automation activity remains available in the SALTA system log.
- Cyclic device-action graphs remain rejected.
- Active-rule re-entry protection remains enabled.
- The automation core remains separated from PostgreSQL/configuration side effects through injected persistence and logging interfaces.

## Existing SALTA functionality retained

- Shelly cards retain the direct shortcut to each Shelly device web interface.
- Virtual switches remain available in SALTA and HomeKit.
- HomeMatic thermostat **Off**, **Manual** and **Automatic** controls remain available.
- Room-assigned devices remain grouped on the overview page.
- Devices without a valid room assignment remain excluded from the overview.
- Compact responsive device cards remain optimized for desktop, tablet and mobile layouts.
- SALTA-owned frontend assets continue to use no-store caching across upgrades.

## Security and dependency status

- No production npm dependency was added or changed in v0.8.4.
- The transitive dependency tree remains unchanged from v0.8.3 apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7 with its matching integrity checksum.
- Retains the patched `fast-uri` dependency lines already present in the lockfile.
- Retains PostCSS 8.5.20.
- Retains TypeScript 5.9.3 from `package-lock.json`.

## Compatibility

- No destructive database migration is required.
- No new environment variables are required.
- Existing v0.8.x automation rules remain compatible.
- Existing Shelly, Zigbee, OpenCCU/HomeMatic, virtual-device, room and HomeKit configuration remains compatible.

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
0.8.4
0.8
latest
```

## Git tag

```text
v0.8.4
```
