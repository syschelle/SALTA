# SALTA v0.8.9

SALTA v0.8.9 hardens realtime Aqara/deCONZ button handling and adds compact multi-event selection for button-triggered automations. WebSocket delivery remains the preferred realtime path, while a button-only fallback now keeps Aqara triggers functional when the deCONZ WebSocket port is not reachable from the SALTA container.

## Aqara / deCONZ button-event reliability

- Fixed a reliability gap where Aqara `ZHASwitch` devices could be visible in SALTA but repeated button presses were not registered as new automation events.
- deCONZ continues to provide the authoritative button action through `state.buttonevent`.
- SALTA now also tracks the deCONZ `state.lastupdated` revision for button resources.
- A repeated event such as `1002` followed by another `1002` is treated as a new press when `lastupdated` changes.
- WebSocket sensor resource IDs are accepted whether deCONZ serializes the `id` as a string or an integer.
- Incoming button events update the device's `lastEvent` timestamp even when the numeric `buttonevent` value is identical to the previous one.
- Button resource ID and last deCONZ update revision are retained in adapter metadata for reliable event matching.

## WebSocket plus button-only fallback

- The persistent deCONZ WebSocket remains the primary event path.
- When the WebSocket is connected, button events are handled immediately and the fallback is disabled.
- If the WebSocket port is unavailable, connecting, closed or temporarily unreachable, SALTA starts a lightweight fallback that polls only deCONZ sensor resources needed for button devices.
- The fallback interval is two seconds and is active only while realtime WebSocket delivery is unavailable.
- The fallback compares `lastupdated`, not only the numeric `buttonevent`, so identical consecutive clicks are recognized.
- WebSocket and fallback delivery share an event signature to avoid executing the same physical button press twice.
- When the WebSocket reconnects successfully, fallback polling stops automatically.
- Existing 15-second full Zigbee reconciliation remains unchanged for inventory and general state recovery.

## Realtime diagnostics

The Phoscon settings status now reports the realtime path in addition to normal REST connectivity:

- **Realtime: WebSocket verbunden** when push events are active.
- **Realtime: Fallback-Abfrage aktiv** when button-only fallback polling is protecting the automation path.
- The time of the last received button event is shown when available.
- Realtime connection failures remain separate from the normal Phoscon REST connection status, making it easier to identify port or network issues.

## Multiple events for one button trigger

A single button trigger can now match multiple deCONZ event values without adding several visible trigger rows.

For example, one Aqara Mini Switch trigger can be configured for:

- **1002 · Einfachklick**
- **1004 · Doppelklick**

Both values are OR-linked and execute the same automation.

- The event picker is shown only when **Tasterereignis** is selected.
- It remains collapsed by default and displays either the selected event or a compact count such as **2 Ereignisse ausgewählt**.
- Selecting several events does not clutter the automation card.
- Internally the selected values use the existing OR-trigger persistence model, so no database migration is required.
- Existing rules with one event remain fully compatible.
- Existing v0.8.8 additional device OR triggers can still be combined with multiple events on the primary button.
- The global limit of eight trigger definitions per automation remains active.

## Aqara event-code note

SALTA uses the normalized deCONZ `state.buttonevent` value, not a raw Zigbee attribute counter.

For common Aqara models exposed by deCONZ, the existing readable event mapping remains available. The raw numeric deCONZ value is always shown so the actual gateway mapping remains transparent.

## Existing automation functionality retained

- Multiple device triggers remain OR-linked.
- Optional **Only if** conditions remain available.
- Target actions remain **On**, **Off** and **Toggle**.
- Searchable device selectors remain available for trigger, condition and target devices.
- Automation room assignment remains available.
- Last successful execution remains displayed as **Heute**, **Gestern** or **vor X Tagen** plus local time.
- Cross-system automation between Shelly, Zigbee, HomeMatic and SALTA-native virtual devices remains supported.
- Cycle detection includes all OR triggers.

## Persistence and schema

- No new database table or column is required for v0.8.9.
- No `ALTER TABLE` migration is introduced.
- The canonical schema policy introduced and repaired in v0.8.7 remains intact.
- Existing v0.8.x automations remain compatible.
- No fresh PostgreSQL volume is required.

## Existing SALTA functionality retained

- Shelly cards retain the direct shortcut to each Shelly web interface.
- Virtual switches remain available in SALTA and HomeKit.
- HomeMatic thermostat **Off**, **Manual** and **Automatic** controls remain available.
- Room-assigned devices remain grouped on the overview page.
- Devices without a valid room assignment remain excluded from the overview.
- Compact responsive cards remain optimized for desktop, tablet and mobile layouts.

## Security and dependency status

- No production npm dependency was added or changed in v0.8.9.
- The transitive dependency tree remains unchanged from v0.8.8 apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7 with its matching integrity checksum.
- Retains the patched `fast-uri` dependency versions already present in the lockfile.
- Retains PostCSS 8.5.20.
- Retains TypeScript 5.9.3.

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
0.8.9
0.8
latest
```

## Git tag

```text
v0.8.9
```
