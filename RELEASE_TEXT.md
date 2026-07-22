# SALTA v0.4.20

SALTA v0.4.20 improves room icon selection and room-name synchronization.

## Fixed

- Replaced free-text MDI icon entry with a visual room-icon selector
- Added common room choices for living rooms, bedrooms, kitchens, bathrooms, offices, garages and outdoor areas
- Added an icon preview while selecting a room icon
- Renaming a room now updates all assigned device cards immediately
- Synchronized room names in PostgreSQL and the live device registry

## Updating

No database migration is required.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.20
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.20
0.4
latest
```

## Git Tag

```text
v0.4.20
```
