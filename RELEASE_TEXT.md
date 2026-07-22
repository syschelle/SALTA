# SALTA v0.4.25

SALTA v0.4.25 moves the device name into the top row next to the icon to make device cards more compact.

## Fixed and Improved

- Placed the device name directly beside the icon in the top header row
- Kept the reachability dot on the right side of the same header row
- Moved room and type metadata directly below the title in the same compact title block
- Reduced vertical whitespace at the top of device cards
- Kept the compact measurement presentation and colored state-card styling
- Added frontend regression coverage for the compact device-title layout

## Updating

No database migration is required.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.25
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.25
0.4
latest
```

## Git Tag

```text
v0.4.25
```
