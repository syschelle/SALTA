# SALTA v0.4.22

SALTA v0.4.22 improves room-based organization in the device overview.

## Fixed and Improved

- Grouped devices by their assigned room
- Applied the order configured on the Rooms page to the device overview
- Added accessible up and down controls for arranging rooms
- Persisted the complete room order atomically in PostgreSQL
- Placed unassigned devices in a final dedicated group
- Replaced the device-card Configure label with a compact gear-only button
- Added frontend and API regression coverage

## Updating

No manual database migration is required.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.22
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.22
0.4
latest
```

## Git Tag

```text
v0.4.22
```
