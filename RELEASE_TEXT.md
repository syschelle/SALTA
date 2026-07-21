# SALTA v0.4.17

SALTA v0.4.17 adds configurable logical device functions for switchable Shelly devices and improves HomeKit preparation.

## Highlights

- Present compatible Shelly devices as a light, switch, outlet or fan
- Keep automatic type detection as the default
- Use the selected function in both SALTA and HomeKit
- Preserve the physical Shelly type and command target internally
- Persist the selected function in PostgreSQL
- Rebuild the HomeKit service automatically after a function change
- Prevent unsupported assignments for meters, sensors and window coverings

## Device Function Configuration

Open a compatible device and select **Configure**. The new **Device function** section offers:

- Automatic
- Light
- Switch
- Outlet
- Fan

Automatic mode keeps the type detected from the Shelly model and component. A manual selection changes the logical presentation only. It does not modify the Shelly firmware profile, relay wiring, channel assignment, measurement capabilities or command routing.

The selector is available for devices that provide independent on/off control, including common Shelly 1, Shelly 1PM, Plug S and compatible relay channels.

## Dashboard

The selected function controls the icon and type label shown on the SALTA device card. Live state, power and energy values continue to come from the physically detected Shelly component.

## HomeKit

SALTA maps the selected function to the corresponding HAP service:

- Light → `Lightbulb`
- Switch → `Switch`
- Outlet → `Outlet`
- Fan → `Fanv2`

Changing the function causes SALTA to rebuild the bridged accessory service with the same stable accessory identity.

A relay represented as a fan remains an on/off fan. Variable fan speed is not exposed unless a future adapter provides a real speed-control capability.

## Safety and Compatibility

SALTA keeps the physically detected device type separate from the selected presentation type. This prevents a logical HomeKit or dashboard choice from changing low-level Shelly commands.

Energy meters, motion sensors, thermostats and window coverings cannot be assigned an incompatible relay function.

Existing devices default to **Automatic**, so current installations retain their previous behavior after updating.

## Database Migration

The `presentation_type` column is added automatically during startup. No manual database migration is required.

## Quality Assurance

The following checks completed successfully:

- TypeScript strict type check
- 58 automated tests
- Production build
- Frontend JavaScript syntax validation
- Shell script syntax validation

## Updating

Keep the existing `SALTA_ENCRYPTION_KEY` unchanged. To pin this release:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.17
```

Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.17
0.4
latest
```

## Git Tag

```text
v0.4.17
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
