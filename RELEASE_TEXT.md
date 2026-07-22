# SALTA v0.4.23

SALTA v0.4.23 adds colored state cards for switches and lights and removes the redundant status value from those device cards.

## Fixed and Improved

- Added green device-card styling for reachable switches and lights in the **On** state
- Added red device-card styling for reachable switches and lights in the **Off** state
- Removed the redundant On/Off status metric from colored switch and light cards
- Kept compact spacing and compact measurement presentation from the recent device-card layout work
- Left energy meters, covers, outlets and other device types unchanged
- Added frontend regression coverage for card-state coloring and hidden status metrics

## Updating

No database migration is required.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.23
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.23
0.4
latest
```

## Git Tag

```text
v0.4.23
```
