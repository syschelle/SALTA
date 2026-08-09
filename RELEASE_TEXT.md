# SALTA v0.8.6

SALTA v0.8.6 refines the Automations editor, adds optional room assignments to automation rules and makes the last automation event easier to read with relative local timestamps. The realtime deCONZ/Phoscon button-event support introduced in v0.8.5 remains fully available.

## Automation editor alignment

- Reworked the Automations editor layout so fields align consistently across the entire form.
- Search controls no longer inherit the generic form-label grid styling that caused the magnifier, input and device selector to look offset.
- Device search is now rendered as a dedicated flex control with a consistent height.
- Trigger and value/event fields are grouped into an aligned two-column row on desktop.
- Optional condition state/value fields use the same layout.
- The layout automatically collapses to a clean single-column form on narrow screens.
- Name, room and enabled state are grouped into a compact metadata section at the top of the editor.
- The automation editor keeps the wider desktop column introduced for large device lists while remaining responsive on tablets and phones.

## Automation room assignment

- Added an optional **Room** selector to the automation create/edit form.
- An automation can be assigned to any existing SALTA room or left unassigned.
- Existing automations created by previous v0.8.x releases remain valid and appear as unassigned until a room is selected.
- The selected room is persisted in PostgreSQL.
- Added an additive `room_id` column to the existing `automations` table.
- The room reference uses `ON DELETE SET NULL`, so deleting a SALTA room never deletes the automation itself.
- SALTA also clears the in-memory room metadata immediately after a room is deleted, so the Automations page does not require a restart to reflect the change.
- The API validates that a selected room still exists before an automation is created or updated.
- Automation cards display the assigned room as a compact room badge.

## Relative last-event display

- Replaced the previous raw locale timestamp on automation cards with a compact relative label.
- The last successful automation execution is now displayed using local browser time as:
  - **Heute · HH:MM Uhr** for an event from today;
  - **Gestern · HH:MM Uhr** for an event from yesterday; or
  - **vor X Tagen · HH:MM Uhr** for older events.
- Automations that have never executed display **Letztes Event: noch nicht ausgeführt**.
- The stored timestamp remains the existing ISO/timestamptz value; this is a presentation change only.

## Realtime Zigbee button events retained from v0.8.5

- The persistent deCONZ/Phoscon WebSocket client remains active with automatic reconnect and WebSocket-port discovery from the gateway.
- `ZHASwitch` and compatible `ZGP` resources continue to be imported as dedicated SALTA button devices.
- Aqara/Xiaomi `lumi.remote...` devices remain available as automation triggers even though they are read-only event devices.
- Every received deCONZ `buttonevent` continues to be published as a discrete SALTA event.
- Repeated identical event values are intentionally not deduplicated, so two consecutive single-click events execute the matching automation twice.
- Known Aqara model identifiers continue to expose readable deCONZ event choices while retaining the raw numeric event code.
- REST reconciliation remains available for inventory recovery while realtime button events use the WebSocket path.

## Automation engine retained

SALTA continues to use the persistent local automation model:

**When → Only if (optional) → Then**

### Trigger

- Boolean state transitions remain supported.
- deCONZ button events remain supported as discrete event triggers.
- Repeated polling of an unchanged boolean value does not retrigger a rule.
- Repeated button events with the same event code do trigger again.

### Optional condition

- One optional boolean device condition remains supported.
- The condition device must be different from the trigger device.
- Physical condition devices must be reachable before the action executes.

### Action

A compatible target device can execute:

- **On**
- **Off**
- **Toggle**

Cross-system rules continue to work between Shelly, Zigbee, HomeMatic and SALTA-native virtual devices through the shared `DeviceCommandRouter`.

## Searchable automation device selectors retained

- Trigger, optional condition and target device selectors remain searchable.
- Search covers device name, room, integration/source, model and logical device type.
- Multiple search terms can be combined.
- Match counts remain visible.
- Device options remain sorted by room and then by device name.
- Existing selections remain preserved while search text is refined.

## Persistence and compatibility

- The automation room change is additive and does not require a destructive database migration.
- Existing v0.8.x automation rules remain compatible.
- Existing Shelly, Zigbee, OpenCCU/HomeMatic, virtual-device, room and HomeKit configuration remains compatible.
- No new production environment variable is required.

## Build and regression protection

- Added frontend regression coverage for the room selector and aligned automation form structure.
- Added regression coverage for relative **Heute / Gestern / vor X Tagen** event labels.
- Added database-schema coverage for the additive automation room column and room foreign key.
- Added API coverage for valid and stale automation room assignments.
- Added engine coverage proving room metadata survives enable/disable updates and is cleared when its room is removed.
- Existing test-symbol preflight, release validation and media-query-aware CSS checks remain active.

## Security and dependency status

- No production npm dependency was added or changed in v0.8.6.
- The transitive dependency tree remains unchanged from v0.8.5 apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7 with its matching integrity checksum.
- Retains the patched `fast-uri` dependency lines already present in the lockfile.
- Retains PostCSS 8.5.20.
- Retains TypeScript 5.9.3 from `package-lock.json`.

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
0.8.6
0.8
latest
```

## Git tag

```text
v0.8.6
```
