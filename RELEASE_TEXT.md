# SALTA v0.4.19

SALTA v0.4.19 fixes visual flickering on device cards during live status refreshes.

## Fixed

- Removed hover elevation and shadow changes from device cards
- Prevented card animations from replaying when the device grid refreshes
- Kept subtle hover and pressed feedback on buttons and button-style links
- Added frontend regression coverage

## Updating

No database migration is required.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.19
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.19
0.4
latest
```

## Git Tag

```text
v0.4.19
```
