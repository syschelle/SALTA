# SALTA v0.8.78

SALTA v0.8.78 adds realtime classic HomeMatic button support through OpenCCU. The implementation is based on the XML-RPC event payload observed from real `HM-PB-6-WM55` devices: OpenCCU exposes six `KEY` channels with empty `VALUES` paramsets and sends button actions such as `PRESS_SHORT` through `system.multicall` callbacks.

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

- No database migration is required for the v0.8.78 OpenCCU button integration.
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
