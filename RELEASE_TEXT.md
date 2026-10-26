# SALTA v0.8.133

SALTA v0.8.133 improves FRITZ!Box Smart Home login handling and makes intermittent REST synchronization failures diagnosable without exposing credentials.

## Changes

- Respect the FRITZ!Box login `BlockTime` and wait until AVM allows the next credential submission.
- Serialize concurrent Smart Home login attempts so periodic synchronization and manual connection tests cannot authenticate in parallel.
- Record HTTP status, request method, Smart Home REST endpoint and a sanitized structured AVM error response when synchronization fails.
- Add FRITZ!Box Smart Home opt-in settings and runtime connection status to the sanitized SALTA diagnostic export.
- Strip credential, authorization, token and session fields from structured AVM error bodies before they reach the system log.
- Keep non-JSON HTTP error responses limited to format/size metadata instead of logging arbitrary response text.

## Root Cause

SALTA v0.8.132 treated AVM's `BlockTime` as an immediate failure. The 30-second reconciliation cycle could therefore start another login attempt even while the FRITZ!Box explicitly prohibited additional attempts. AVM documents `BlockTime` as the number of seconds during which no further login attempt is allowed.

The production diagnostic also showed successful Smart Home synchronization followed by repeated HTTP 400 responses. v0.8.132 discarded the FRITZ!Box response body for non-2xx REST responses, so the actual AVM error details were unavailable for diagnosis. v0.8.133 preserves safe structured error details while deliberately avoiding an unproven protocol workaround for HTTP 400.

## Compatibility

- Existing FRITZ!Box Smart Home opt-in settings remain unchanged.
- FRITZ!Box Smart Home remains disabled by default on new and upgraded installations unless explicitly enabled.
- Existing imported FRITZ!Box devices remain unchanged.
- Existing FRITZ!Box presence detection remains independent and unchanged.
- No database schema change or manual migration is required.
- Existing Shelly, Phoscon/deCONZ, Hue, OpenCCU, automation and HomeKit data remain unchanged.
- No new npm dependency or mandatory environment variable is introduced.

## Tests

- Verify that no credential POST is sent before AVM `BlockTime` expires.
- Verify that structured HTTP 400 error details retain status/method/endpoint while secret fields are removed.
- Verify structured Smart Home error-body sanitization.
- Verify Smart Home settings and runtime status are wired into the sanitized diagnostic export.
- Release validator, JavaScript syntax checks, TypeScript build and the complete Vitest suite must pass before release.

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
