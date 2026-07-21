# SALTA v0.4.12

SALTA v0.4.12 adds display-name editing for all registered devices, including Shelly 3EM energy meters and other non-switching device types.

## Highlights

- Rename any registered device from its configuration dialog
- Full support for naming Shelly 3EM energy meters
- Shared naming workflow across switches, outlets, lights, covers and meters
- Automatic HomeKit name synchronization
- New frontend and API regression coverage

## Device Naming

The device configuration dialog now includes a required **Display name** field. Open any device, select **Configure**, enter the preferred name and save the changes.

Previously, the API already supported device-name updates, but the web interface exposed only room and credential settings. Devices such as the Shelly 3EM therefore remained on their automatically detected name after onboarding.

SALTA now:

- Loads the current name into the device configuration dialog
- Validates the name before saving
- Removes leading and trailing whitespace
- Stores the new name persistently
- Updates the dashboard immediately
- Recreates the optional HomeKit accessory with the updated name

## Supported Device Types

Display-name editing is available for all registered device types, including:

- Switches
- Outlets
- Lights
- Window coverings
- Energy meters
- Power meters

## Updating

No manual database migration is required.

To pin this release:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.12
```

Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Quality Assurance

The following checks completed successfully:

- TypeScript strict type check
- 31 automated tests
- Production build
- Frontend JavaScript syntax validation
- Shell script syntax validation

## Container Tags

```text
0.4.12
0.4
latest
```

## Git Tag

```text
v0.4.12
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
