# SALTA v0.3.0-alpha.1

## Added

- Introduced rooms as first-class database entities.
- Added room creation, listing, editing and deletion APIs.
- Added device-to-room assignment and an unassigned-device state.
- Added room filtering and room management to the dashboard.
- Added global Shelly username and encrypted password settings.
- Added per-device credential modes: inherit, custom and none.
- Added per-device credential configuration in the dashboard.
- Added AES-256-GCM encryption for stored passwords.

## Changed

- Device responses now expose `roomId`, credential mode and password configuration state.
- Device values are displayed with user-friendly German labels and units.
- The health endpoint reports version `0.3.0-alpha.1`.

## Security

- Passwords are never returned by the REST API.
- `SALTA_ENCRYPTION_KEY` is required by Docker Compose and must be backed up securely.

## Docker

- linux/amd64
- linux/arm64

This alpha release establishes the room and credential foundations required for the real Shelly adapter. It does not yet discover or control physical Shelly devices.
