# SALTA v0.4.26

SALTA v0.4.26 fixes the frontend regression test for the compact device-card layout introduced in v0.4.25.

## Fixed

- Updated the compact device-card regression test to match the current value spacing
- Expected measurement spacing now matches `margin-top: 11px` and `padding-top: 10px`
- Restored successful CI and release builds
- No runtime behavior or database schema changes

## Updating

No database migration is required.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.26
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.26
0.4
latest
```

## Git Tag

```text
v0.4.26
```
