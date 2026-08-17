## v0.8.84

- Fixed the two v0.8.83 frontend CI regressions caused by stale test expectations after the configurable Appearance integration.
- The authenticated application startup test now expects the saved Appearance palette to load after session authentication and before normal application data/navigation startup.
- The overview room-group test now verifies `#eef2ff` as the default `--overview-room-bg` theme token and verifies that room blocks consume that configurable CSS variable instead of requiring a hard-coded background value.
- No runtime code, database schema, Appearance behavior, automation behavior, HomeKit behavior, dependency or deployment-topology change is required.

# Changelog

## v0.8.83

- Added a dedicated **Darstellung / Appearance** settings page with Standard, Ocean, Forest, Warm, Graphite and Custom profiles.
- Added separate light and dark palettes with 27 individually configurable central UI colors per mode.
- Individual color changes automatically switch the profile to Custom while preserving the rest of the selected palette.
- Added live preview, exact HEX editing and native color pickers.
- Made the overview room background a configurable theme token; Standard Light keeps `#eef2ff`.
- Appearance settings use the existing backed-up `notification_state` persistence and require no database migration.
- Added API validation/rate limiting and frontend/API regression coverage.
- Carries forward the v0.8.82 overview cleanup unchanged.

## v0.8.82

- Removed the descriptive subtitle below **Favoriten** on the overview.
- Replaced the overview room-group gradients from v0.8.81 with a single solid `#eef2ff` background.
- Removed alternating room-group coloring so every room boundary uses the same calm visual treatment.
- Added regression coverage for the subtitle removal and the solid room-group background.
- Carries forward the v0.8.81 room-group separation and the v0.8.80 Favorites lifecycle fix unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.81

- Removed the explanatory overview hint below **Geräte nach Räumen**.
- Improved visual separation of room sections on the overview by rendering each room group inside its own background block.
- Added regression coverage for the simplified overview heading and room-group styling.
- Carries forward the v0.8.80 Favorites lifecycle/CI fix unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.80

- Fixed the v0.8.79 push-test regressions caused by the new canonical `favorite: false` device field.
- Registry lifecycle test fixtures now model the canonical favorite state explicitly instead of comparing an old pre-Favorites device shape.
- `ShellyAdapter.add()` now returns the canonical device stored in `DeviceRegistry` after persistence, preserving the existing contract that the returned device matches the registry representation.
- The Favorites feature, `device_favorites` persistence, overview rendering and backup/restore behavior from v0.8.79 are unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.
