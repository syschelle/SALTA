# SALTA v0.8.5

SALTA v0.8.5 adds real-time deCONZ/Phoscon button events to the local automation engine. Zigbee remotes such as Aqara `lumi.remote...` devices are now imported as dedicated button devices and can trigger automations immediately through the deCONZ WebSocket event stream.

## Real-time Phoscon / deCONZ events

- Added a persistent deCONZ WebSocket client to the Phoscon adapter.
- SALTA reads the gateway WebSocket port from the deCONZ `config.websocketport` value, so no additional port setting is required in SALTA.
- The WebSocket connection is started after a successful Phoscon synchronization.
- Added automatic reconnect with bounded exponential backoff after gateway, network or socket interruptions.
- The existing REST reconciliation remains active as a recovery and inventory path.
- Added handling for deCONZ sensor `changed`, `added` and `deleted` events.
- Added and deleted resources cause an inventory reconciliation so newly paired or removed sensors are reflected in SALTA.

## Zigbee buttons and remotes

- `ZHASwitch` and compatible `ZGP` switch resources are imported as SALTA devices of type **Button**.
- Aqara/Xiaomi resources such as `lumi.remote...` are no longer lost because they are read-only event devices.
- Button resources are kept as dedicated SALTA devices and are not merged into a matching actuator card.
- Added a fallback for deCONZ switch resources without a usable `uniqueid`, using the stable gateway resource identifier instead of dropping the device completely.
- The current `buttonevent` and battery state remain visible on the Zigbee device card.
- Sensor resource IDs are stored in adapter metadata so incoming WebSocket messages can be resolved back to the correct SALTA device without polling.

## Discrete button-event bus

- Added a dedicated SALTA `deviceEvent` channel beside the existing device-state update channel.
- Every received deCONZ `buttonevent` is published as a discrete event.
- Repeated identical values are intentionally not deduplicated.
- Two consecutive button messages carrying the same value therefore trigger two automation events.
- The latest event value is still persisted in the normal device state for display and diagnostics.

## Button-event automation triggers

The existing automation structure remains:

**When → Only if (optional) → Then**

The **When** stage now supports both:

- boolean device-state transitions; and
- Zigbee/deCONZ button events.

For a supported button device, the trigger editor offers **Button event** and a list of event codes. The raw deCONZ value is always shown together with a readable action label.

Common button actions include:

- short click / short release;
- double click;
- hold;
- release;
- triple and additional multi-click events where the device exposes them.

Known Aqara model identifiers receive focused event choices, including the WXKG11LM families exposed by deCONZ as `lumi.remote.b1acn01` or `lumi.sensor_switch.aq2`. The currently observed raw `buttonevent` is also retained as a selectable value when it is not part of the predefined list.

### Aqara / deCONZ event-code note

SALTA evaluates the normalized deCONZ `state.buttonevent` value delivered by the REST/WebSocket API. This is distinct from a raw Zigbee `attribute_id` and raw attribute value. For the deCONZ mapping of the Aqara WXKG11LM 2018 model (`lumi.remote.b1acn01`), the focused choices are `1002` short release / single click, `1004` double press, `1001` hold and `1003` long release. The raw numeric deCONZ code is always shown in the UI so the actual gateway mapping stays visible.

## Repeated-event execution

- Event-triggered rules are queued per automation instead of being discarded while a previous action is still running.
- Rapid repeated button presses are therefore executed sequentially.
- Existing boolean transition rules continue to fire only when the configured state is actually entered.
- Optional device conditions are evaluated immediately before each queued action is executed.
- Existing cycle protection remains active.

## Cross-system examples

Examples now supported include:

- Aqara Zigbee button single click → Shelly light **Toggle**.
- Aqara Zigbee button double click → Shelly relay **Off**.
- Zigbee button event → only if a HomeMatic or virtual switch is **On** → target device **Toggle**.
- Zigbee button event → SALTA/HomeKit virtual switch **On/Off/Toggle**.

Actions continue to use the shared `DeviceCommandRouter`, so trigger and target devices may belong to different supported integrations.

## Searchable automation selectors retained

- Trigger, condition and target device selectors remain searchable.
- Search covers device name, room, integration/source, model and logical device type.
- Button devices are included in the trigger-device search even though they do not expose a writable switch state.
- Optional condition devices remain limited to devices that expose boolean state because conditions in the current v0.8.x rule model are still state based.

## Persistence and compatibility

- No database schema migration is required for v0.8.5.
- Button-event triggers are encoded in the existing automation trigger key, preserving the current PostgreSQL automation table and existing v0.8.x rules.
- Existing boolean automation rules remain unchanged and compatible.
- Existing Shelly, Zigbee, OpenCCU/HomeMatic, virtual-device, room and HomeKit configuration remains compatible.
- No new production environment variable is required.

## Existing SALTA functionality retained

- Shelly cards retain the direct shortcut to each Shelly device web interface.
- Virtual switches remain available in SALTA and HomeKit.
- HomeMatic thermostat **Off**, **Manual** and **Automatic** controls remain available.
- Room-assigned devices remain grouped on the overview page.
- Devices without a valid room assignment remain excluded from the overview.
- Compact responsive device cards remain optimized for desktop, tablet and mobile layouts.
- SALTA-owned frontend assets continue to use no-store caching across upgrades.

## Build and test reliability

- Added Phoscon mapping tests for `ZHASwitch` / Aqara button resources.
- Added deCONZ WebSocket URL and message parsing tests.
- Added automation-engine coverage proving that two identical button events execute twice.
- Added frontend coverage for deCONZ button-event trigger choices.
- Added release validation for the WebSocket client, reconnect path, event bus and automation event subscription.
- Existing test-symbol preflight and media-query-aware frontend tests remain active.

## Security and dependency status

- No new npm package is required for WebSocket support; SALTA uses the WebSocket client available in the supported Node.js runtime.
- No production npm dependency was added or changed in v0.8.5.
- The transitive dependency tree remains unchanged from v0.8.4 apart from the SALTA root version.
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
0.8.5
0.8
latest
```

## Git tag

```text
v0.8.5
```
