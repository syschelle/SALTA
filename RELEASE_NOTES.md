# SALTA v0.4.29

SALTA v0.4.29 fixes the TypeScript compilation failure in the security-enabled server tests introduced with v0.4.28.

## Fixed

- Corrected the typed helper used for authenticated Fastify request injection
- Replaced the invalid `Parameters<typeof server.inject>[0]` inference with the official `InjectOptions` type
- Added `light-my-request` as an explicit development dependency
- Restored TypeScript compilation for `src/server.test.ts`
- Kept all security hardening from v0.4.28 unchanged

## Notes

The GitHub Actions Node.js runtime and `punycode` messages are deprecation warnings and were not the cause of the failed build. The build stopped because TypeScript treated the overloaded zero-argument `inject()` signature as the helper parameter type.

## Updating

No database migration is required. Keep the existing `SALTA_ENCRYPTION_KEY` unchanged.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.29
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.29
0.4
latest
```

## Git Tag

```text
v0.4.29
```
