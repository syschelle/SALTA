# SALTA v0.8.81

SALTA v0.8.81 polishes the overview after the Favorites integration. The explanatory hint below **Devices by room** has been removed and the room groups on the overview now sit inside clearer background blocks so neighboring rooms are easier to distinguish at a glance.

## v0.8.81 overview room-group clarity

- Removed the explanatory overview hint text below **Geräte nach Räumen / Devices by room**.
- The overview room groups now render inside their own bordered background blocks instead of visually running directly into the page background.
- Added an alternating subtle/accent-tinted room-group background treatment so adjacent room sections are easier to distinguish in long overviews.
- The underlying room order, room grouping logic and device-card behavior are unchanged.
- Favorites still remain positioned between the global system cards and the room-grouped overview.
- Favorites still intentionally duplicate the same live device card: once in Favorites and once in its assigned room.
- Added frontend regression coverage for the simplified overview heading and the overview room-group styling.
- No backend logic, database schema, automation behavior, HomeKit behavior, new environment variable or deployment-topology change is required.

## v0.8.80 Favorites lifecycle regression fix

- Fixed the four failing v0.8.79 Vitest assertions caused by the new canonical `favorite: false` field on stored devices.
- Updated the shared Registry lifecycle fixture to include `favorite: false`.
- Updated `ShellyAdapter.add()` to return the canonical Registry device after persistence.
- The v0.8.79 Favorites UI and persistence behavior remain unchanged.
- No database schema migration, manual SQL command, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.79 overview device favorites

- Added a per-device **Show as favorite** option to the existing device configuration dialog.
- Favorite devices are rendered in a dedicated **Favorites** section directly between Daylight/Vacation/Heating/Battery controls and **Devices by room**.
- Marking a device as a favorite does not remove or move it from the room-grouped overview.
- Favorite cards reuse the existing device-card renderer, including live state, controls and configuration actions.
- Added the additive `device_favorites` table and backup/restore support.
- Hidden Zigbee devices and internal Presence/SALTA system devices are excluded from Favorites.

## Compatibility

- v0.8.81 does not add or alter database schema.
- The additive `device_favorites` table introduced in v0.8.79 remains unchanged.
- Existing Favorites remain persistent across adapter refreshes.
- Existing OpenCCU JSON-RPC polling and realtime XML-RPC button events remain unchanged.
- Existing Presence targets and named-person profiles remain compatible.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- No manual database migration is required.
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
