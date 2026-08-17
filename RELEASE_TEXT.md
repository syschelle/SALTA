# SALTA v0.8.80

SALTA v0.8.80 fixes the four v0.8.79 CI regressions caused by introducing the canonical per-device Favorites state. The Favorites runtime behavior remains unchanged; the release aligns lifecycle tests with the new device shape and restores the Shelly add/registry return-value contract.

## v0.8.80 Favorites lifecycle regression fix

- Fixed the four failing v0.8.79 Vitest assertions reported by CI. All four failures were caused by the new canonical `favorite: false` field appearing on devices stored in `DeviceRegistry`.
- Updated the shared Registry lifecycle test fixture to include `favorite: false`, so exact-equality assertions model the current canonical `Device` representation.
- Updated `ShellyAdapter.add()` to return the canonical device from `DeviceRegistry` after persistence instead of returning the pre-normalized local object.
- This preserves the pre-existing lifecycle contract verified by the Shelly test: the object returned by `add()` is equal to the device held by the registry.
- The v0.8.79 Favorites UI, duplicate Favorites/room rendering, `device_favorites` table, adapter refresh preservation and backup/restore behavior are unchanged.
- No database schema migration, manual SQL command, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.79 overview device favorites

- Added a per-device **Show as favorite** option to the existing device configuration dialog.
- Favorite devices are rendered in a dedicated **Favorites** section directly between Daylight/Vacation/Heating/Battery controls and **Devices by room**.
- Marking a device as a favorite does not remove or move it from the room-grouped overview. The same live device can intentionally appear once in Favorites and once in its normal room.
- Favorite cards reuse the existing device-card renderer, including live state, switch/cover/light/thermostat controls, Shelly web links and the configuration button.
- The Favorites section remains completely hidden when no devices are marked as favorites, avoiding additional overview clutter.
- Hidden Zigbee devices are not displayed in Favorites while hidden. Presence helper devices and internal SALTA `system` devices are also excluded.
- Added the additive `device_favorites` table. Existing database tables are not altered and no manual SQL migration is required.
- Device adapter refreshes preserve the favorite flag.
- Configuration and disaster-recovery backups include `device_favorites`. Older signed format-v1 backups without the additive table remain importable and restore with no favorites selected.
- Carries forward the v0.8.78 realtime OpenCCU/HomeMatic button integration and all previous overview/system functionality unchanged.
- No new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.78 OpenCCU/HomeMatic button events

- Added classic HomeMatic `KEY` channel support, including all six channels of `HM-PB-6-WM55`.
- `KEY` channels are represented as separate SALTA `button` devices even when `Interface.getParamset(..., "VALUES")` returns an empty object.
- If OpenCCU provides a dedicated channel name, SALTA uses it. Otherwise a readable fallback such as `Wandtaster Wohnzimmer · Taste 2` is generated from the physical device name and channel number.
- Added a local XML-RPC callback listener on TCP `18099`. When the synchronized catalogue contains `KEY` channels, SALTA registers that callback with the corresponding OpenCCU XML-RPC interface; classic `BidCos-RF` uses OpenCCU port `2001`.
- Added immediate automation button events for `PRESS_SHORT`, `PRESS_LONG` and `PRESS_LONG_RELEASE`. They map to SALTA's existing button-event model as short click, hold and release.
- Repetitive `PRESS_CONT` callbacks are deliberately ignored so holding a button cannot create an automation-event flood. OpenCCU's diagnostic `INSTALL_TEST` callback is also ignored.
- `HM-PB-6-WM55` devices offer only the three supported event choices in the automation editor.
- The most recent button event is kept on the SALTA button state across the normal 60-second OpenCCU polling cycle.
- XML-RPC registration is invalidated when the normal OpenCCU connection fails and is renewed automatically after a successful reconnect, covering OpenCCU restarts without restarting SALTA.
- XML-RPC callback setup is non-fatal: if callback registration fails, normal OpenCCU polling and device control continue and the problem is written to the System Log.
- The callback instance identifier is randomized per SALTA process. No OpenCCU session identifier or credential is exposed through the callback endpoint.
- The OpenCCU host must be able to connect to the SALTA host on TCP `18099`. SALTA's existing production `network_mode: host` topology already allows the listener to bind directly to the LAN address used to reach OpenCCU.
- No database schema migration, new mandatory environment variable or npm dependency is required.

## v0.8.77 named presence people

- Added a separate **Person name** field to each monitored Presence entry, alongside the existing **Device name** and MAC address.
- The compact overview Presence status now displays the currently present names, for example `Martin, Lisa`, instead of only `2 of 2 present`.
- When more than three people are present, the overview keeps the compact layout by showing the first three names followed by `+N`; the full count and full list remain available in the card tooltip.
- The dedicated Presence page house summary also shows the currently present person names.
- Presence target cards now show the person name as the primary title and the device name as secondary information, making entries such as `Martin` / `Martins iPhone` easy to distinguish.
- Existing presence targets remain fully compatible. If a target has no separate person profile yet, SALTA automatically uses its existing target/device name as the display-name fallback until the entry is edited.
- Added the additive `presence_target_profiles` table rather than changing the existing `presence_targets` table. Normal startup creates it automatically; no `ALTER TABLE` or manual SQL migration is required.
- The presence adapter carries the person display name into the read-only presence device metadata and publishes aggregate `presentNames` / `memberNames` state on `presence:house` for the overview.
- Configuration and disaster-recovery backups include `presence_target_profiles`. Older signed format-v1 backups without the table remain importable and restore with the existing-name fallback.
- Existing presence automations (`present`, `anyHome`, `nobodyHome`) are unchanged.
- No new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.76 overview hierarchy cleanup carried forward

- Combined the five top-level metrics — Devices, Reachable, Current power, Rooms and Presence — into one compact house-status band.
- Rebalanced Daylight, Vacation mode, Heating mode and Batteries into four equal-width quick-control cards on wide screens.
- Removed explanatory copy from the quick-control cards so current state, controls and warnings receive visual priority.
- Preserved all existing Daylight, Vacation mode, Heating mode and Battery functionality.
- Added responsive desktop, tablet and mobile overview layouts.

## Compatibility

- v0.8.79 adds the additive `device_favorites` table during normal schema initialization. No existing table is altered and no manual database command is required.
- Existing devices default to not being favorites until explicitly selected.
- Older signed format-v1 configuration/disaster-recovery backups without `device_favorites` remain importable and restore with no favorites selected.
- The v0.8.78 OpenCCU button integration requires no database migration.
- Existing OpenCCU JSON-RPC polling and device-control behavior remains active and unchanged for normal states and actuators.
- The OpenCCU host must be able to reach the SALTA host on TCP `18099` for realtime HomeMatic `KEY` events. No Docker Compose port mapping is required because SALTA continues to use `network_mode: host`.
- Normal startup automatically creates the additive `presence_target_profiles` table.
- No existing table is altered and no manual database command is required.
- Existing Presence targets remain valid; before a separate person name is saved, the existing target/device name is used as the display-name fallback.
- Existing Presence automations remain compatible and unchanged.
- Existing configuration and disaster-recovery backups remain importable.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- Vacation mode, Heating mode, multiple AND conditions, daily time triggers and the PostgreSQL JSONB startup fix remain unchanged.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `down -v` during the update.
