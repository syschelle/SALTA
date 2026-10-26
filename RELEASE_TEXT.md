# SALTA v0.8.138

SALTA v0.8.138 updates security-sensitive npm dependencies to patched releases and supersedes the unreleased v0.8.137 tree.

## Changes

- Upgrade Fastify from the vulnerable 5.12.5 release to the patched 5.12.6 release line.
- Upgrade Zod from the vulnerable 3.x release line to the patched 4.6.6 release line.
- Adapt the two SALTA backup record schemas to the Zod 4 `z.record(keySchema, valueSchema)` API without changing accepted backup data.
- Upgrade Vitest from 4.1.11 to the patched 4.1.12 release line, which also updates `@vitest/mocker`.
- Update transitive `fast-uri` overrides from 3.1.8 to 3.1.9 and from 4.2.2 to 4.2.3.
- Update release-validator and regression-test security floors so vulnerable versions cannot silently regress.
- Retain all FRITZ!OS diagnostic improvements from v0.8.137.

## Root Cause

GitHub Dependabot identified newly published advisories affecting the dependency versions present in the v0.8.137 lockfile. The affected packages included direct runtime dependencies (`zod`, `fastify`), a development dependency through `@vitest/mocker`, and multiple transitive `fast-uri` instances that were explicitly pinned by SALTA overrides.

The previous pins were valid when introduced, but newly disclosed upstream vulnerabilities made those exact versions unsuitable for release. Zod 4 also requires an explicit key schema for `z.record`, so the two existing backup schemas needed a syntax-only compatibility update. v0.8.138 moves every affected dependency family to an upstream patched version and validates the complete SALTA application against the resulting dependency graph.

## Compatibility

- No database schema migration is required.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain unchanged.
- Existing configuration and disaster-recovery backup payload formats remain unchanged.
- Existing FRITZ!Box, Shelly, deCONZ, Hue, OpenCCU, virtual-device and automation configuration remains unchanged.
- FRITZ!Box Smart Home authentication remains PBKDF2-only.
- No manual npm installation is required on the production host when using `docker-compose.image.yml`.

## Tests

- GitHub Actions runs the complete SALTA release validator.
- JavaScript syntax checks run for all release-critical browser bundles.
- TypeScript production build and type validation run against the updated dependency graph.
- The complete Vitest suite runs against Zod 4.6.6, Fastify 5.12.6 and Vitest 4.1.12.
- `npm audit --audit-level=low` must complete without known npm advisories before the validated tree is committed.
- GitHub CodeQL on `main` remains the final security scan after integration.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.
