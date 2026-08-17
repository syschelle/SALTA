# SALTA v0.8.84

SALTA v0.8.84 is a regression-test maintenance release for the configurable Appearance system introduced in v0.8.83. The two failing frontend tests were stale expectations: runtime behavior remains unchanged.

## v0.8.84 Appearance regression-test maintenance

- Updated the authenticated frontend startup regression test to match the v0.8.83 startup sequence: SALTA first establishes the protected browser session, then loads the persisted Appearance palette, and only then starts normal navigation/application data loading and the live-refresh timer.
- This preserves the security contract that application data is not loaded before authentication while also preventing a flash of the wrong saved palette during normal startup.
- Updated the overview room-group regression test so `#eef2ff` is verified as the Standard light-theme default of `--overview-room-bg` rather than as a hard-coded room-card declaration.
- The room-group rule is now explicitly verified to use `background: var(--overview-room-bg)`, which is required for the per-color Appearance configuration from v0.8.83.
- The tests continue to reject the removed gradient and alternating `nth-child` room backgrounds from earlier overview revisions.
- No runtime JavaScript, CSS behavior, backend logic, database schema, Appearance persistence, automation behavior, HomeKit behavior, mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.83 configurable appearance profiles

- Added a dedicated **Darstellung / Appearance** settings page.
- Added five ready-to-use color profiles: **Standard**, **Ocean**, **Forest**, **Warm** and **Graphite**, plus **Custom**.
- Every profile contains separate light and dark palettes.
- Added 27 individually editable central theme colors per mode, including the overview room-group background and complete ON/OFF device-state colors.
- Color editing supports both a native color picker and exact six-digit hexadecimal values.
- Changing a single color automatically switches the current profile to **Custom** while preserving the rest of the selected palette.
- The existing Light/Dark toggle remains available and applies the corresponding saved palette.
- The Standard light palette keeps the requested room-group background `#eef2ff` through the configurable `--overview-room-bg` theme token.
- Appearance settings are persisted through the existing backed-up `notification_state` mechanism using the `appearance-settings` key. No new database table or `ALTER TABLE` migration is required.
- No new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.82 overview visual cleanup

- Removed the descriptive subtitle below **Favorites**.
- Replaced overview room-group gradients with the requested solid `#eef2ff` background.
- Removed alternating room-group colors.
- Room borders, spacing, room order and device behavior remained unchanged.

## Compatibility

- v0.8.84 changes only frontend regression tests and release metadata; runtime behavior is identical to v0.8.83.
- Appearance configuration continues to use the existing `notification_state` table and is covered by the existing backup/disaster-recovery handling for that table.
- Existing installations without saved Appearance settings continue to use the Standard profile.
- The existing `salta_theme` cookie continues to store only the active Light/Dark mode; the selected color palette remains server-side.
- Existing Favorites, Presence profiles, OpenCCU realtime button events, Vacation mode, Heating mode, multiple AND conditions and daily time triggers remain unchanged.
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
