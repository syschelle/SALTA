# SALTA v0.4.31

SALTA v0.4.31 fixes the outdated frontend theme regression test after the security hardening moved early theme initialization into a CSP-compatible external script.

## Fixed

- Updated the theme persistence test to inspect `public/theme-init.js`
- Verified that `/theme-init.js` is loaded before the first stylesheet
- Kept early cookie-based theme selection without inline JavaScript
- Preserved the strict Content Security Policy introduced by the security hardening
- No runtime behavior or database schema changes

## Updating

No database migration is required. Keep the existing `SALTA_ENCRYPTION_KEY`, admin credentials and security settings unchanged.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.31
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.31
0.4
latest
```

## Git Tag

```text
v0.4.31
```
