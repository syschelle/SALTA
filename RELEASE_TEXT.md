# SALTA v0.8.0

SALTA v0.8.0 introduces the first persistent local automation engine. Automations can react to device state changes, optionally check the current state of another device, and then switch a target device On, Off or Toggle through the shared SALTA command router.

## Version milestone

The project roadmap has been re-baselined for the current implementation state.

The original roadmap placed the automation engine in v0.7.x and the dashboard in v0.8.x. During development, the room-based dashboard, compact device controls, virtual devices and HomeKit command routing were completed in the v0.7.x line. The automation engine is therefore introduced as the next architectural milestone in **v0.8.0**.

The current roadmap is:

- **v0.7.x:** device integrations, room dashboard, responsive controls, virtual switches and shared HomeKit routing
- **v0.8.x:** automation engine and rule extensions
- **v0.9.x:** planned assistant and advanced orchestration
- **v1.0.0:** first stable production release

## Local automation engine

- Added a persistent event-driven automation engine that runs locally inside SALTA.
- Added a new **Automations** section to the desktop and mobile navigation.
- Automation rules are persisted in PostgreSQL and restored automatically after a SALTA restart.
- The engine listens to the common SALTA device registry, so triggers can originate from Shelly, Zigbee, HomeMatic or SALTA-native virtual devices.
- Actions use the shared `DeviceCommandRouter`, allowing one supported device family to control another.

## Rule structure

The initial automation model contains three stages:

### 1. When

Select:

- a trigger device;
- one of the boolean states currently exposed by that device; and
- the state value that should fire the rule.

The automation fires only when the selected state **changes into** the configured value. Repeated adapter polling with the same state does not retrigger the rule.

Examples include:

- motion becomes detected;
- a contact becomes open or closed;
- a switch becomes on or off;
- a water or alarm state becomes active or inactive.

### 2. Only if

An optional device condition can be enabled.

Select:

- another device;
- one of its boolean states; and
- the required current value.

The condition is evaluated when the trigger fires. A physical condition device must currently be reachable; stale offline state is not used to authorize an automation action.

### 3. Then

Select a target device and one of the actions supported by that device:

- **On**
- **Off**
- **Toggle**

The target device must be different from the trigger device.

## Automation management

- Create automation rules from the web interface.
- Edit existing rules.
- Enable or disable rules without deleting them.
- Delete rules permanently.
- Display the last successful execution time.
- Display the configured trigger, condition and action as a compact rule flow.
- Automation system-log entries can be filtered using the new **Automations** source.

## Loop protection

- SALTA validates the device-action graph before saving or enabling a rule.
- Automation configurations that would create a cyclic device-action graph are rejected.
- This prevents simple toggle loops such as device A toggling device B while device B toggles device A.
- The engine also tracks rules currently being executed to prevent immediate re-entrant execution.

## Persistence

- Added an additive `automations` table to the canonical PostgreSQL schema.
- No destructive database migration is required.
- Existing installations keep the current schema generation and receive the new table automatically during normal startup.
- Trigger, condition and target device references use database foreign keys.
- Removing a referenced device automatically removes dependent automation rules from PostgreSQL, while the running engine also removes them from its in-memory rule set.

## API

Added authenticated and rate-limited endpoints for:

- listing automations;
- creating automations;
- updating automations;
- enabling or disabling automations; and
- deleting automations.

Automation input is validated on both the API boundary and inside the automation engine.

## Current v0.8.0 scope

The first automation release intentionally supports:

- boolean device-state transition triggers;
- one optional boolean device condition; and
- one On, Off or Toggle action.

Later v0.8.x releases can extend the same engine with additional trigger and rule types such as button events, numeric thresholds, timers, schedules, delays, multiple conditions and multiple actions.

## Existing functionality retained

- Shelly device cards retain the direct shortcut to the local Shelly web interface introduced in v0.7.18.
- Virtual switches remain available in SALTA and HomeKit.
- HomeMatic thermostat Off, Manual and Automatic controls remain available.
- The room-based overview continues to show only devices with a valid room assignment.
- Compact responsive device cards remain optimized for desktop, tablet and mobile layouts.
- The hardened test-symbol preflight and release validation remain part of the complete quality gate.

## Security and dependency status

- No new production npm dependency was added for the automation engine.
- The transitive dependency tree remains unchanged from v0.7.18 apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7 with its matching integrity checksum.
- Retains TypeScript 5.9.3 from the lockfile.
- All automation mutation routes use explicit application and Fastify rate limiting.

## Compatibility

- No new environment variables are required.
- No destructive database migration is required.
- Existing Shelly, Zigbee, OpenCCU/HomeMatic, room, virtual-device and HomeKit configuration remains compatible.
- Existing device IDs and room assignments remain unchanged.

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
0.8.0
0.8
latest
```

## Git tag

```text
v0.8.0
```
