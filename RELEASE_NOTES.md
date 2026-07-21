# SALTA v0.4.14

SALTA v0.4.14 adds complete profile-aware onboarding for Shelly 2PM devices.

## Added

- Active device-profile detection through `/shelly` and `Shelly.GetDeviceInfo`
- Component configuration and channel-name retrieval through `Shelly.GetConfig`
- Separate logical devices for `switch:0` and `switch:1` in switch profile
- A single unified window-covering device for `cover:0` in cover profile
- Persistent storage of the detected profile
- Channel information in the device-card metadata
- A channel-aware onboarding success message

## Reliability

- Commands for the second switch card are sent with component ID `1`.
- Live refresh selects the matching component instead of always using channel 0.
- Re-adding an existing 2PM preserves the existing primary name and room when no new values are supplied.
- Existing single-channel devices and Gen1 devices remain unchanged.

## Compatibility

No manual migration is required. The database schema is extended automatically during startup.

An existing 2PM can be added again using the same address to create its missing second switch channel.

## Quality assurance

The release passes TypeScript strict checking, 40 automated tests, frontend JavaScript syntax validation and the production build.
