# SALTA v0.8.85

SALTA v0.8.85 fixes the Appearance profile preview path introduced in v0.8.83. Selecting a named profile now applies its palette directly to the active page, and the **Apply profile** button uses the same direct CSS-variable path with visible confirmation.

## v0.8.85 Appearance profile application fix

- Fixed the reported issue where selecting a color profile and pressing **Profil anwenden / Apply profile** did not visibly change the SALTA page.
- Profile preview no longer depends on a second generic theme pass re-reading an intermediate preview object. The selected profile palette is now applied directly to the CSS custom properties for the currently active Light or Dark mode.
- Selecting **Standard**, **Ocean**, **Forest**, **Warm** or **Graphite** immediately previews the selected profile.
- The existing **Apply profile** button remains available and explicitly reapplies the selected profile while showing a confirmation message.
- Applying a profile still prepares both its Light and Dark palettes, so switching the sidebar Light/Dark mode continues to use the matching side of the selected profile.
- Individual color editing remains available and still switches the working palette to **Custom** without discarding the other selected colors.
- **Save appearance** remains the persistence boundary; previews are not written to the server until the user saves them.
- Added frontend regression coverage that requires the profile selection and Apply button to call the direct palette application path.
- No database schema migration, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.84 Appearance regression-test maintenance

- Updated two stale frontend tests after the configurable Appearance integration.
- Authentication coverage now expects the saved Appearance palette to load after the protected session and before normal application data loading.
- Room-group coverage now verifies `#eef2ff` as the Standard `--overview-room-bg` default and verifies that room groups consume the configurable CSS variable.
- Runtime behavior was unchanged in v0.8.84.

## v0.8.83 configurable appearance profiles

- Added **Settings → Appearance** with Standard, Ocean, Forest, Warm, Graphite and Custom profiles.
- Added separate Light and Dark palettes with 27 individually editable colors per mode.
- Added exact HEX editing and native color pickers.
- Made the overview room-group background configurable while keeping `#eef2ff` as the Standard Light default.
- Appearance settings use the existing backed-up `notification_state` persistence and require no database migration.

## Compatibility

- v0.8.85 changes only frontend Appearance application logic, frontend regression coverage and release metadata.
- Appearance settings continue to use the existing `notification_state` table.
- Existing saved Appearance settings remain compatible.
- Existing Favorites, Presence profiles, OpenCCU realtime button events, Vacation mode, Heating mode, multi-condition automations and daily time triggers remain unchanged.
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
