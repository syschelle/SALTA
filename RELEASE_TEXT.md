# SALTA v0.4.14

SALTA v0.4.14 adds profile-aware onboarding for multi-profile Shelly 2PM devices and exposes both switch channels as independent devices.

## Highlights

- Reads the active `switch` or `cover` profile from Shelly device information
- Reads component configuration and channel names through `Shelly.GetConfig`
- Creates two independent device cards for a 2PM in switch profile
- Creates one window-covering device for a 2PM in cover profile
- Routes commands and live values to the correct component ID
- Preserves existing names and room assignments when a device is added again

## Shelly 2PM Profiles

Shelly Plus 2PM, Pro 2PM and compatible multi-profile devices can expose different component sets depending on their active profile.

### Switch profile

When the device reports the `switch` profile, SALTA registers every `switch:<id>` component separately. A two-channel 2PM therefore appears as two independent devices, each with:

- Its own dashboard card
- Its own on/off state
- Its own power and energy values when available
- Its own configurable SALTA display name
- Its own command target (`Switch` component ID 0 or 1)

Names configured directly on the Shelly are imported from `Shelly.GetConfig`. When no channel name is configured, SALTA generates a numbered fallback name.

### Cover profile

When the device reports the `cover` profile, SALTA registers the unified `cover:0` component as one window-covering device. The two relay outputs are not shown as independent switches because the Shelly firmware controls them together as a motorized cover.

## Existing Installations

No manual database migration is required. SALTA adds the optional device-profile field automatically during startup.

A Shelly 2PM that was already added with an earlier SALTA version can be added again using the same IP address. SALTA keeps the existing primary device ID, preserves its current name and room when no replacement values are entered, and creates the missing second switch channel.

## API

The existing onboarding endpoint remains:

```http
POST /api/adapters/shelly/devices
```

Its response now also contains:

```json
{
  "addedDevices": 2
}
```

for a two-channel switch profile. Existing primary-device response fields remain available for compatibility.

## Quality Assurance

The following checks completed successfully:

- TypeScript strict type check
- 40 automated tests
- Production build
- Frontend JavaScript syntax validation
- Shell script syntax validation

## Updating

Keep the existing `SALTA_ENCRYPTION_KEY` unchanged. To pin this release:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.14
```

Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.14
0.4
latest
```

## Git Tag

```text
v0.4.14
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
