# SALTA v0.8.83

SALTA v0.8.83 adds configurable appearance profiles and full per-color theme customization. The existing light/dark switch remains available, while **Settings → Appearance** now lets users select a complete preset or customize the light and dark palettes independently.

## v0.8.83 configurable appearance profiles

- Added a dedicated **Darstellung / Appearance** settings page.
- Added five ready-to-use color profiles: **Standard**, **Ocean**, **Forest**, **Warm** and **Graphite**, plus **Custom**.
- Every profile contains a separate light and dark palette, so switching between Light and Dark mode keeps a coherent profile instead of reusing one palette for both modes.
- Added 27 individually editable central theme colors per mode, including page background, cards, text, muted text, borders, accent, success/online color, buttons, inputs, sidebar, subtle/accent/hover surfaces, dialog and empty-state surfaces, toast colors, room-group background and the complete ON/OFF device-state colors.
- Color editing supports both a native color picker and an exact six-digit hexadecimal value.
- Changing a single color automatically switches the current profile to **Custom** while preserving every other color from the selected profile.
- Profile and color changes can be previewed immediately before saving. Separate Light and Dark preview buttons are available from the settings page.
- The existing sidebar Light/Dark toggle remains unchanged and now applies the selected appearance palette for the corresponding mode.
- The overview room-group background introduced in v0.8.82 is now represented by the configurable `--overview-room-bg` theme token. The Standard light palette keeps the requested `#eef2ff` value.
- Appearance settings are persisted under the existing backed-up `notification_state` mechanism using the `appearance-settings` key. No new database table or `ALTER TABLE` migration is required.
- The settings API accepts only complete palettes with six-digit hexadecimal colors, preventing arbitrary CSS values from being persisted.
- Added explicit rate limits and regression coverage for the Appearance API, profiles, individual color editing, light/dark separation and persistence.
- No new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.82 overview visual cleanup

- Removed the descriptive subtitle below **Favorites**.
- Replaced the overview room-group gradients with the requested solid `#eef2ff` background.
- Removed alternating room-group colors.
- Room borders, spacing, room order and device behavior remained unchanged.

## v0.8.81 overview room-group clarity

- Removed the explanatory hint below **Devices by room**.
- Added clear bordered room blocks on the overview so neighboring rooms are easier to distinguish.
- Room grouping logic and device cards remained unchanged.

## v0.8.80 Favorites lifecycle regression fix

- Fixed the v0.8.79 Favorites CI regressions caused by the canonical `favorite: false` field.
- `ShellyAdapter.add()` returns the canonical Registry device after persistence.
- Favorites behavior and persistence remain unchanged.

## Compatibility

- v0.8.83 does not add or alter database schema.
- Appearance configuration uses the existing `notification_state` table and is therefore already covered by configuration/disaster-recovery backup handling for that table.
- Existing installations without Appearance settings automatically use the Standard profile.
- The existing `salta_theme` cookie continues to store only the active Light/Dark mode; the selected palette is stored server-side.
- The additive `device_favorites` and `presence_target_profiles` tables remain unchanged.
- OpenCCU JSON-RPC polling and realtime XML-RPC button events remain unchanged.
- Vacation mode, Heating mode, multiple AND conditions and daily time triggers remain unchanged.
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
