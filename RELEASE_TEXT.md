# SALTA v0.4.32

SALTA v0.4.32 resolves the seven open GitHub CodeQL findings reported after the security hardening release.

## Security Fixes

- Added the official `@fastify/rate-limit` plugin for CodeQL-recognized Fastify route protection
- Added explicit per-route limits to login, readiness, room-list, Shelly-settings, device-command and command-history endpoints
- Kept SALTA's existing global, per-client, mutation, login-failure and expensive-operation limits as an additional protection layer
- Replaced the Digest authentication challenge regular expression with a bounded linear parser
- Preserved support for quoted, escaped and unquoted Digest challenge attributes
- Added regression coverage for all explicitly rate-limited routes and the new Digest parser

## CodeQL Findings Addressed

- Six `js/missing-rate-limiting` findings in `src/server.ts`
- One inefficient regular expression finding in `src/shelly-adapter.ts`

## Updating

No database migration is required. Keep the existing `SALTA_ENCRYPTION_KEY`, admin credentials and reverse-proxy settings unchanged.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.32
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.32
0.4
latest
```

## Git Tag

```text
v0.4.32
```
