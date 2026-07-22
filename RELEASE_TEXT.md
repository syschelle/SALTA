# SALTA v0.4.21

SALTA v0.4.21 makes the device overview more compact and removes unnecessary whitespace from device cards.

## Fixed

- Short device cards no longer stretch to the height of larger cards in the same row
- Reduced card padding and spacing between title, metadata, values and actions
- Compacted measurement labels and action buttons
- Reduced the size of window-covering position controls without removing functionality
- Added frontend regression coverage for the compact layout

## Updating

No database migration is required.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.21
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.21
0.4
latest
```

## Git Tag

```text
v0.4.21
```
