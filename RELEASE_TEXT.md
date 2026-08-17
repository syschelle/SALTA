# SALTA v0.8.82

SALTA v0.8.82 further simplifies the overview. The descriptive subtitle below **Favorites** is removed, and the room-group boundaries introduced in v0.8.81 now use a single solid `#eef2ff` background instead of gradients or alternating colors.

## v0.8.82 overview visual cleanup

- Removed the **Schnellzugriff auf deine wichtigsten Geräte.** subtitle below the **Favoriten / Favorites** heading.
- Replaced the room-group gradient backgrounds introduced in v0.8.81 with the requested solid HTML color `#eef2ff`.
- Removed alternating room-group background colors so every room section uses the same consistent background.
- The room-group border, rounded corners, spacing, room order and device-card behavior remain unchanged.
- Favorites remain positioned between the global system controls and the normal room-grouped devices.
- Favorite devices still intentionally remain visible both in Favorites and in their assigned room.
- Added frontend regression coverage that rejects the removed Favorites subtitle and rejects overview room-group gradients.
- No backend logic, database schema, automation behavior, HomeKit behavior, new environment variable or deployment-topology change is required.

## v0.8.81 overview room-group clarity

- Removed the explanatory overview hint text below **Geräte nach Räumen / Devices by room**.
- Added bordered background blocks around overview room groups so neighboring room sections are easier to distinguish.
- The underlying room order, room grouping logic and device-card behavior are unchanged.
- Favorites remain positioned between the global system cards and the room-grouped overview.
- Added frontend regression coverage for the simplified overview heading and room-group styling.
- No backend logic, database schema, automation behavior, HomeKit behavior, new environment variable or deployment-topology change is required.

## v0.8.80 Favorites lifecycle regression fix

- Fixed the four failing v0.8.79 Vitest assertions caused by the new canonical `favorite: false` field on stored devices.
- Updated the shared Registry lifecycle fixture to include `favorite: false`.
- Updated `ShellyAdapter.add()` to return the canonical Registry device after persistence.
- The v0.8.79 Favorites UI and persistence behavior remain unchanged.
- No database schema migration, manual SQL command, new mandatory environment variable, npm dependency or deployment-topology change is required.

## Compatibility

- v0.8.82 changes only overview HTML/CSS and the corresponding frontend regression tests.
- No database schema is added or altered.
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
