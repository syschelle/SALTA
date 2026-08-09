# SALTA v0.8.3

SALTA v0.8.3 improves the Automations editor for installations with many devices by adding searchable device selectors for triggers, optional conditions and target actions. The automation engine and CI hardening from the previous v0.8.x releases remain unchanged.

## Searchable automation device selectors

- Added a dedicated search field above the **Trigger device** selector.
- Added the same search capability for the optional **Condition device** selector.
- Added the same search capability for the **Target device** selector.
- Search is performed immediately in the browser without additional API requests.
- Multiple search terms can be entered and all terms must match the device metadata.
- Device search covers:
  - device name;
  - assigned room;
  - source / integration such as Shelly, Zigbee, HomeMatic or Virtual;
  - device model; and
  - logical SALTA device type.
- Each selector shows the number of currently available devices or the number of matches for the active search.
- Device options are sorted consistently by room and then by device name.
- The currently selected device is retained while refining a search so an existing automation is not accidentally changed merely by typing into the search field.
- Search fields are cleared when a new device is chosen, the form is reset or an existing automation is opened for editing.

## Automation editor layout

- Increased the minimum width of the automation editor on large desktop screens so long device names, room names and integration labels are easier to read.
- The editor automatically switches back to a single-column layout on narrower screens.
- Search controls remain full-width and compact on mobile devices.
- Existing state, condition-value and action selectors remain unchanged.

## Automation engine retained from v0.8.0

SALTA continues to provide the local persistent rule model:

**When → Only if (optional) → Then**

### Trigger

- Choose a trigger device.
- Choose one boolean state exposed by that device.
- Choose the value that should fire the rule.
- Rules trigger only when the selected state changes into the configured value.
- Repeated polling with an unchanged value does not retrigger the rule.

### Optional condition

- One optional condition device can be selected.
- The condition device must be different from the trigger device.
- Choose one boolean state and the required value.
- The condition is evaluated when the trigger fires.
- Physical condition devices must be reachable before the action is allowed to execute.

### Action

A compatible target device can execute:

- **On**
- **Off**
- **Toggle**

The target device must be different from the trigger device.

## Cross-system automations

- Trigger devices can originate from Shelly, Zigbee, HomeMatic or SALTA-native virtual devices.
- Conditions can reference another supported device integration.
- Actions continue to use the shared `DeviceCommandRouter`.
- Cross-system rules such as Zigbee motion → HomeMatic condition → Shelly switch remain supported.
- SALTA/HomeKit virtual switches remain usable as automation targets where their capabilities match the configured action.

## Automation management and persistence

- Create, edit, enable, disable and delete automation rules in the web interface.
- Automation rules remain persisted in PostgreSQL and restored after restart.
- The last successful execution time remains visible in the rule list.
- Automation activity remains available in the SALTA system log.
- Cyclic device-action graphs remain rejected.
- Active-rule re-entry protection remains enabled.
- No database migration is required for v0.8.3.

## CI and test reliability retained from v0.8.2

- `npm test` continues to run through SALTA's self-contained test-symbol preflight runner.
- Required test-only configuration is initialized before Vitest starts.
- The test runner does not depend on a standalone `vitest.config.ts` or `test-setup.ts` file.
- The automation core remains isolated from the production PostgreSQL/configuration layer.
- `npm run check` continues to run release validation, TypeScript checking, the test-symbol preflight, Vitest, the production build and browser JavaScript syntax checks.
- Added frontend regression coverage for all three automation device search fields and the shared search/filter implementation.

## Existing SALTA functionality retained

- Shelly cards retain the direct shortcut to the Shelly device web interface.
- Virtual switches remain available in SALTA and HomeKit.
- HomeMatic thermostat **Off**, **Manual** and **Automatic** controls remain available.
- Room-assigned devices remain grouped on the overview page.
- Unassigned devices remain excluded from the room overview.
- Compact responsive device cards remain optimized for desktop, tablet and mobile layouts.

## Security and dependency status

- No production npm dependency was added or changed in v0.8.3.
- The transitive dependency tree remains unchanged from v0.8.2 apart from the SALTA root version.
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
0.8.3
0.8
latest
```

## Git tag

```text
v0.8.3
```
