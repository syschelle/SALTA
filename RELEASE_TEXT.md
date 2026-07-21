# SALTA v0.4.7

SALTA v0.4.7 adds safe and persistent removal of Shelly devices directly from the web interface.

## Highlights

- Remove Shelly devices from the device configuration dialog
- Immediate removal from the dashboard and device registry
- Automatic cleanup of associated command history
- Automatic removal of the corresponding HomeKit accessory
- Protection against devices being recreated by a concurrent status refresh
- Removed devices can be added again later

## Device Removal

Open a Shelly device, select **Configure**, and use the new **Remove device from SALTA** action.

A confirmation explains that this action removes only the SALTA registration and locally stored device data. The physical Shelly device is not reset, switched off or otherwise modified.

After confirmation, SALTA removes:

- The persistent device record
- Device-specific stored credentials
- Associated command history
- The in-memory device entry
- The corresponding HomeKit accessory

## API

The release adds:

```http
DELETE /api/devices/:id
```

Successful removal returns:

```text
204 No Content
```

Unknown devices return a structured `404` response.

## Reliability

Device deletion is protected against concurrent adapter refreshes. If a Shelly status request is already running while the device is removed, the stale result cannot restore the deleted device.

A deliberately re-added Shelly is accepted normally through the existing add-device workflow.

## Quality Assurance

The release includes automated tests for:

- Persistent device removal
- In-memory registry cleanup
- Removal events
- Stale refresh protection
- Deliberate device re-adding

TypeScript strict type checking, the automated test suite and the production build are executed before release packaging.

## Updating

No manual database migration is required.

To pin this release explicitly:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.7
```

Then update with:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.7
0.4
latest
```

## Git Tag

```text
v0.4.7
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
