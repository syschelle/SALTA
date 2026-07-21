# SALTA v0.4.18

SALTA v0.4.18 replaces custom interface symbols with locally bundled Material Design Icons.

## Changes

- Local MDI icons for navigation, devices, actions, rooms and theme switching
- No CDN or external runtime request
- Room icon names use the MDI identifier, for example `sofa-outline`
- Pictogrammers source and Apache License 2.0 documented in the README
- MDI license included in `public/vendor/mdi/LICENSE`

## Updating

No database migration is required.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.18
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.18
0.4
latest
```

## Git Tag

```text
v0.4.18
```
