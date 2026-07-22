# SALTA v0.4.24

SALTA v0.4.24 extends colored state cards to Shelly Plug S and other outlet devices and softens the card border coloring.

## Fixed and Improved

- Extended green/red state-card styling to outlet devices such as Shelly Plug S (`SHPLG-S`)
- Kept colored cards for reachable switches and lights
- Removed the redundant On/Off status metric from colored outlet cards as well
- Softened the right and outer border coloring so the card accent feels less heavy
- Kept the compact device-card spacing and compact measurement presentation
- Added frontend regression coverage for outlet state coloring

## Updating

No database migration is required.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.24
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.24
0.4
latest
```

## Git Tag

```text
v0.4.24
```
