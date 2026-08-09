# SALTA v0.8.1

SALTA v0.8.1 fixes the GitHub CI collection failure introduced with the first automation release and hardens the boundary between automation logic, persistence and test configuration. The complete automation functionality introduced in v0.8.0 is retained unchanged.

## Build fix

- Fixed the Vitest collection failure caused by the automation core importing `db.ts` during module initialization.
- The failing import chain was `automations.test.ts` → `automations.ts` → `db.ts` → `config.ts`.
- Because `config.ts` validates the production environment immediately, GitHub CI failed before the automation tests could run when `DATABASE_URL`, `ADMIN_PASSWORD`, `SALTA_HEALTH_TOKEN` and `SALTA_ENCRYPTION_KEY` were intentionally absent from the test process.
- Automation unit tests no longer load the production database or configuration layer as a side effect.

## Automation architecture hardening

- Separated the pure automation engine from PostgreSQL persistence and system logging.
- `src/automations.ts` now depends only on injected interfaces:
  - `AutomationStore` for rule persistence; and
  - `AutomationLogger` for automation log events.
- Added `src/automation-persistence.ts` as the production adapter between the automation engine and the existing PostgreSQL/database functions.
- `main.ts` now explicitly injects the database-backed automation store and logger when SALTA starts.
- The automation engine therefore remains unit-testable without importing `db.ts`, creating a PostgreSQL pool or parsing production secrets.
- The no-op logger remains available to isolated tests unless a logger is explicitly injected.

## Centralized Vitest environment

- Added a central `vitest.config.ts` setup file configuration.
- Added `src/test-setup.ts` with deterministic test-only values for the mandatory application configuration fields:
  - `DATABASE_URL`
  - `ADMIN_PASSWORD`
  - `SALTA_HEALTH_TOKEN`
  - `SALTA_ENCRYPTION_KEY`
- Test values use `??=` so explicitly provided CI or test-specific values are never overwritten.
- The test setup also disables HomeKit and uses silent logging by default.
- The production TypeScript build explicitly excludes `src/test-setup.ts`, so test-only configuration is not emitted into the production application.

## Regression protection

- Added regression coverage that verifies the automation core does not import `db.ts` directly.
- Added regression coverage that verifies production persistence is injected from `main.ts`.
- Added regression coverage for the central Vitest setup and all four required configuration variables.
- Extended `npm run validate:release` so a release fails if:
  - the automation core regains a direct database dependency;
  - the production automation persistence adapter is missing;
  - `main.ts` stops injecting the persistence/logger adapters;
  - Vitest stops loading the centralized test environment; or
  - the Vitest-only setup is accidentally included in the production TypeScript build.
- The existing unresolved-test-symbol preflight from v0.7.17 remains active before Vitest.

## Automation engine retained from v0.8.0

SALTA continues to provide the first persistent local automation engine with the rule structure:

**When → Only if (optional) → Then**

### Trigger

- Select a trigger device.
- Select one of the boolean states exposed by that device.
- Select the boolean value that should fire the automation.
- Automations fire only when the selected state changes into the configured value.
- Repeated polling with an unchanged value does not retrigger the rule.

Typical triggers include:

- switch on/off;
- motion detected/not detected;
- contact open/closed;
- alarm states;
- water states; and
- other boolean device states exposed through SALTA.

### Optional condition

- One optional condition device can be selected.
- The condition device must be different from the trigger device.
- Select one boolean state and the required on/off value.
- The condition is evaluated at the moment the trigger fires.
- Physical condition devices must be reachable before the action is allowed to execute.

### Action

A target device can perform one of the actions it supports:

- **On**
- **Off**
- **Toggle**

The target device must be different from the trigger device.

## Cross-system automations

- Trigger devices can originate from Shelly, Zigbee, HomeMatic or SALTA-native virtual devices.
- Conditions can use devices from another supported integration.
- Actions are dispatched through the shared `DeviceCommandRouter`.
- This allows cross-system rules such as Zigbee motion → HomeMatic condition → Shelly switch action.
- Virtual SALTA/HomeKit switches can also be used as automation targets where their capabilities match the configured action.

## Automation management

- Create automation rules from the web interface.
- Edit existing rules.
- Enable or disable rules without deleting them.
- Delete rules permanently.
- Display the configured trigger, optional condition and target action.
- Display the last successful execution time.
- Automation events remain available through the SALTA system log.

## Loop protection

- SALTA validates the device-action graph before saving or enabling rules.
- Cyclic action graphs are rejected.
- Direct loops such as A toggles B while B toggles A are therefore prevented.
- Active-rule re-entry protection remains in place while an automation action is executing.

## Persistence and API

- Automation rules remain persisted in the PostgreSQL `automations` table.
- No destructive database migration is required.
- Existing v0.8.0 automation records remain compatible.
- Device references continue to use database foreign keys.
- Automation create, read, update, enable/disable and delete endpoints remain authenticated and rate limited.

## Existing SALTA functionality retained

- Shelly cards retain the direct shortcut to each Shelly device web interface.
- Virtual switches remain available in SALTA and HomeKit.
- HomeMatic thermostat Off, Manual and Automatic controls remain available.
- Room-assigned devices remain grouped on the overview page.
- Unassigned devices remain excluded from the room overview.
- Compact responsive device cards remain optimized for desktop, tablet and mobile layouts.
- Stale frontend asset protection remains active after upgrades.

## Security and dependency status

- No new production npm dependency was added in v0.8.1.
- The transitive npm dependency tree remains unchanged from v0.8.0 apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7 with its matching integrity checksum.
- Retains the patched `fast-uri` dependency lines from the existing lockfile.
- Retains PostCSS 8.5.20 from the existing lockfile.
- Retains TypeScript 5.9.3 from `package-lock.json`.

## Compatibility

- No destructive database migration is required.
- No new production environment variables are required.
- Existing v0.8.0 automation rules remain compatible.
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
0.8.1
0.8
latest
```

## Git tag

```text
v0.8.1
```
