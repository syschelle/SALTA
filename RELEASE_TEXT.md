# SALTA v0.8.2

SALTA v0.8.2 fixes the GitHub CI failure caused by a missing standalone `vitest.config.ts` file and makes the Vitest bootstrap self-contained inside SALTA's existing test preflight script. The automation engine introduced in v0.8.0 and the database/test isolation introduced in v0.8.1 remain unchanged.

## Build fix

- Removed the CI dependency on a standalone `vitest.config.ts` file.
- Removed the separate `src/test-setup.ts` bootstrap file.
- `npm test` now runs through the existing `scripts/check-test-symbols.mjs` script.
- The runner executes the unresolved-symbol preflight and then starts the locked local Vitest executable directly with Node.
- The Vitest child process receives deterministic test-only values for:
  - `DATABASE_URL`
  - `ADMIN_PASSWORD`
  - `SALTA_HEALTH_TOKEN`
  - `SALTA_ENCRYPTION_KEY`
- `NODE_ENV` is forced to `test` for the test process.
- HomeKit is disabled and test logging is silenced.
- Explicitly provided database/secrets values are preserved where appropriate.
- The test command no longer relies on a shell-specific environment-variable syntax and remains cross-platform.

## Release validation hardening

- `npm run validate:release` no longer opens or requires `vitest.config.ts`.
- Release validation now checks the actual preflight-backed Vitest runner.
- A release fails if required test configuration is no longer initialized.
- A release fails if the test runner starts depending on `vitest.config.ts` or `test-setup.ts` again.
- `npm test` always performs the unresolved-symbol preflight before Vitest, even when run directly.
- `npm run test:preflight` remains available as a standalone diagnostic command.

## Automation architecture retained from v0.8.1

- The pure automation engine remains independent from PostgreSQL and production configuration side effects.
- `src/automations.ts` uses injected `AutomationStore` and `AutomationLogger` interfaces.
- `src/automation-persistence.ts` remains the production PostgreSQL adapter.
- `main.ts` injects the database-backed automation store and logger during normal SALTA startup.
- Pure automation tests therefore do not need to initialize the production database/configuration layer.

## Automation engine retained from v0.8.0

SALTA continues to provide the first persistent local automation engine with the rule structure:

**When → Only if (optional) → Then**

### Trigger

- Select a trigger device.
- Select one of the boolean states exposed by that device.
- Select the boolean value that should fire the automation.
- Rules fire only when the selected state changes into the configured value.
- Repeated polling with an unchanged value does not retrigger the rule.

Typical trigger states include switch on/off, motion detected/not detected, contact open/closed, water/alarm states and other boolean device states exposed through SALTA.

### Optional condition

- One optional condition device can be selected.
- The condition device must be different from the trigger device.
- Select one boolean state and the required On/Off value.
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
- Conditions can use devices from another supported integration.
- Actions use the shared `DeviceCommandRouter`.
- Rules such as Zigbee motion → HomeMatic condition → Shelly switch are supported.
- SALTA/HomeKit virtual switches can be used as automation targets where their capabilities match the selected action.

## Automation management

- Create, edit, enable, disable and delete automation rules in the web interface.
- Display the configured trigger, optional condition and target action.
- Display the last successful execution time.
- Automation activity remains visible in the SALTA system log.

## Loop protection

- SALTA validates the device-action graph before saving or enabling rules.
- Cyclic action graphs are rejected.
- Direct loops such as A toggles B while B toggles A are prevented.
- Active-rule re-entry protection remains in place while an automation action is executing.

## Persistence and API

- Automation rules remain persisted in PostgreSQL.
- Existing v0.8.0/v0.8.1 automation records remain compatible.
- No destructive database migration is required.
- Automation create, read, update, enable/disable and delete endpoints remain authenticated and rate limited.

## Existing device functionality retained

- Shelly device cards retain the direct shortcut to the Shelly web interface.
- Virtual switches remain available in SALTA and HomeKit.
- HomeMatic thermostat **Off**, **Manual** and **Automatic** controls remain available.
- Room-assigned devices remain grouped on the overview page.
- Devices without a valid room assignment remain excluded from the overview.

## Compact device cards retained from v0.7.14

- Device cards retain reduced padding, compact headers and smaller control spacing.
- Device names and metadata use a compact single-line layout with safe ellipsis.
- Live values remain displayed as responsive measurement chips.
- Dimmer, thermostat and window-covering controls remain grouped in a compact control area.
- The configuration button remains in the card header.
- Read-only sensors do not receive an unnecessary empty action row.
- Device grids remain adaptive across desktop and tablet layouts.
- Smartphone views retain the single-column device layout and compact two-by-two overview statistics.

## Build reliability retained

- CSS tests continue to understand base rules and responsive media-query overrides.
- OpenCCU frontend tests continue to follow composed renderer call graphs instead of fragile exact string matching.
- The unresolved-test-symbol preflight remains active.
- The Docker build and GitHub workflows continue to use the complete `npm run check` quality gate.
- Safe versioning continues to update only SALTA root version fields and known release surfaces.

## Security and dependency status

- No production npm dependency was added or changed in v0.8.2.
- The transitive dependency tree remains unchanged from v0.8.1 apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7 with the matching integrity checksum.
- Retains the patched `fast-uri` dependency lines already present in the lockfile.
- Retains PostCSS 8.5.20.
- Retains TypeScript 5.9.3 from `package-lock.json`.

## Compatibility

- No destructive database migration is required.
- No new production environment variables are required.
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
0.8.2
0.8
latest
```

## Git tag

```text
v0.8.2
```
