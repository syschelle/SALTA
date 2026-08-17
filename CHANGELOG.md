# Changelog

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
