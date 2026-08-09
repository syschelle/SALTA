# SALTA v0.8.7

SALTA v0.8.7 fixes the database-schema build regression introduced in v0.8.6 while retaining the complete automation-room, editor-layout and relative-event improvements from that release. Automation room assignments are now stored through an additive preference table that follows SALTA's canonical clean-schema architecture without incremental `ALTER TABLE` migrations.

## Build and schema fix

- Fixed the failing `clean database schema` regression test.
- Removed `ALTER TABLE automations ADD COLUMN ...` from the canonical database initializer.
- SALTA continues to enforce its clean-schema rule: application startup code contains no incremental `ALTER TABLE` migration statements.
- Release validation now explicitly rejects any `ALTER TABLE` statement in `src/db.ts`.
- The schema regression test continues to enforce the same rule instead of being weakened to accept the v0.8.6 implementation.

## Upgrade-safe automation room persistence

- Added a new additive `automation_preferences` table for optional automation metadata.
- Automation room assignments are stored separately from the canonical `automations` table.
- Existing `automations` rows are not modified and the existing automation table is not altered.
- Existing v0.8.x installations create the new table automatically during normal startup.
- Existing rules remain fully usable and appear without a room until a room assignment is saved.
- Creating or editing an automation upserts its room preference in the same SQL statement as the automation change.
- Reading automations uses a left join, so rules without a preference row remain fully compatible.
- Deleting an automation automatically deletes its preference through `ON DELETE CASCADE`.
- Deleting a room clears only the room reference through `ON DELETE SET NULL`; the automation itself remains intact.
- No database reset and no fresh PostgreSQL volume is required for this additive v0.8.7 change.

## Automation editor alignment retained from v0.8.6

- The Automations editor keeps the corrected field alignment across the complete form.
- Device search controls remain dedicated flex controls with consistent sizing.
- Trigger and event/value fields remain aligned in a two-column desktop row.
- Optional condition state/value fields use the same aligned layout.
- The form automatically collapses to a clean single-column layout on narrow screens.
- Name, room and enabled state remain grouped in the compact metadata area.
- The wider desktop editor remains available for long device names while tablet and mobile layouts remain responsive.

## Automation room assignment retained from v0.8.6

- Every automation can optionally be assigned to an existing SALTA room.
- The room can be selected when creating or editing a rule.
- Automation cards continue to show the assigned room as a compact room badge.
- Leaving the room empty keeps the automation unassigned.
- API validation continues to reject stale or unknown room IDs.
- Removing a room from SALTA does not remove its automations.

## Relative last-event display retained from v0.8.6

The last successful automation execution remains displayed using local browser time:

- **Heute · HH:MM Uhr** for an event from today;
- **Gestern · HH:MM Uhr** for an event from yesterday;
- **vor X Tagen · HH:MM Uhr** for older events; and
- **Letztes Event: noch nicht ausgeführt** when a rule has not run yet.

## Realtime Zigbee button events retained from v0.8.5

- The persistent deCONZ/Phoscon WebSocket client remains active with automatic reconnect and gateway WebSocket-port discovery.
- `ZHASwitch`, compatible `ZGP` resources and Aqara/Xiaomi `lumi.remote...` devices remain available as dedicated SALTA button devices.
- Every received deCONZ `buttonevent` remains a discrete automation event.
- Repeated identical button-event values are intentionally not deduplicated.
- Two consecutive single-click events therefore execute the matching rule twice.
- Raw deCONZ event codes remain visible together with readable event labels.

## Searchable automation selectors retained

- Trigger, optional condition and target device selectors remain searchable.
- Search covers device name, room, integration/source, model and logical device type.
- Multiple search terms can be combined.
- Match counts remain visible.
- Device options remain sorted by room and device name.

## Automation engine retained

SALTA continues to use the local persistent model:

**When → Only if (optional) → Then**

- Boolean state transitions and deCONZ button events remain supported as triggers.
- One optional boolean device condition remains supported.
- Compatible target devices can execute **On**, **Off** or **Toggle**.
- Cross-system rules continue to work across Shelly, Zigbee, HomeMatic and SALTA-native virtual devices.

## Existing SALTA functionality retained

- Shelly cards retain the direct shortcut to each Shelly device web interface.
- Virtual switches remain available in SALTA and HomeKit.
- HomeMatic thermostat **Off**, **Manual** and **Automatic** controls remain available.
- Room-assigned devices remain grouped on the overview page.
- Devices without a valid room assignment remain excluded from the overview.
- Compact responsive device cards remain optimized for desktop, tablet and mobile layouts.

## Build and regression protection

- The canonical schema test verifies that automation room data is stored separately from the `automations` table.
- Regression coverage verifies the `automation_preferences` ownership foreign key, room foreign key, left join and room-preference upsert.
- Release validation rejects incremental `ALTER TABLE` statements.
- Existing unresolved-symbol preflight, responsive CSS inspection and frontend AST checks remain active.

## Security and dependency status

- No production npm dependency was added or changed in v0.8.7.
- The transitive dependency tree remains unchanged from v0.8.6 apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7 with its matching integrity checksum.
- Retains the patched `fast-uri` dependency lines already present in the lockfile.
- Retains PostCSS 8.5.20.
- Retains TypeScript 5.9.3 from `package-lock.json`.

## Compatibility

- No destructive database migration is required.
- No fresh PostgreSQL volume is required for the v0.8.7 room-preference change.
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
0.8.7
0.8
latest
```

## Git tag

```text
v0.8.7
```
