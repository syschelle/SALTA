# Changelog

## v0.8.81

- Removed the explanatory overview hint below **Geräte nach Räumen**.
- Improved visual separation of room sections on the overview by rendering each room group inside its own subtle background block.
- Alternating overview room-group backgrounds now make neighboring rooms easier to distinguish without changing device order or behavior.
- Added regression coverage for the simplified overview heading and the new room-group background styling.
- Carries forward the v0.8.80 Favorites lifecycle/CI fix unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.80

- Fixed the v0.8.79 push-test regressions caused by the new canonical `favorite: false` device field.
- Registry lifecycle test fixtures now model the canonical favorite state explicitly instead of comparing an old pre-Favorites device shape.
- `ShellyAdapter.add()` now returns the canonical device stored in `DeviceRegistry` after persistence, preserving the existing contract that the returned device matches the registry representation.
- The Favorites feature, `device_favorites` persistence, overview rendering and backup/restore behavior from v0.8.79 are unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.79

- Added per-device **Favorites** for the overview.
- Devices can be marked as favorites in the existing device configuration dialog.
- Favorite devices are shown in a dedicated section between the global system cards and the normal room-grouped devices.
- A favorite remains visible in its normal room group as well; Favorites are an additional quick-access view, not a move or separate device copy.
- The Favorites section stays hidden when no devices are selected.
- Favorite device cards use the same live state, controls and configuration actions as normal overview cards.
- Added additive `device_favorites` persistence and configuration/disaster-recovery backup support. Older format-v1 backups without favorites remain compatible.
- Hidden Zigbee devices and internal Presence/SALTA system devices are not rendered as overview favorites.
- Carries forward the v0.8.78 realtime OpenCCU/HomeMatic button support unchanged.
- No existing table is altered, and no new mandatory environment variable or npm dependency is required.
