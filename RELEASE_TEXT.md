# SALTA v0.8.131

SALTA v0.8.131 keeps OpenCCU JSON-RPC sessions alive and automatically recovers sessions that OpenCCU reports as unauthenticated after expiration.

## Changes

- Both SALTA OpenCCU JSON-RPC clients now renew long-lived sessions periodically using `Session.renew`.
- The dedicated thermostat-control client no longer keeps an unrenewed session indefinitely.
- The normal OpenCCU synchronization client uses the same renewal behavior.
- `access denied ("GUEST" needed 0)` is recognized as the OpenCCU expired/unauthenticated-session response seen in production.
- On that response SALTA discards the stale session, performs one fresh `Session.login`, and retries the original OpenCCU request once.
- Existing thermostat datapoints, classic HomeMatic/BidCos mappings, XML-RPC callbacks and the v0.8.130 contact-event fix remain unchanged.

## Root Cause

SALTA authenticated correctly with OpenCCU but cached the returned JSON-RPC session ID indefinitely. The clients never called `Session.renew`, even though OpenCCU requires sessions to be renewed before they expire.

After expiration, OpenCCU can answer authenticated methods such as `Interface.getParamset` and `Interface.setValue` with `access denied ("GUEST" needed 0)`. SALTA's previous expired-session detector did not recognize this response, so it kept reusing the stale session instead of logging in again. This caused manual wall-thermostat changes and scheduled temperature automations to fail until a fresh SALTA/OpenCCU session was created.

v0.8.131 adds proactive session renewal and a bounded one-time re-login/retry path for this production response.

## Compatibility

- No database schema change or migration is required.
- Existing OpenCCU credentials and device mappings remain unchanged.
- Classic HomeMatic/BidCos thermostat datapoints remain unchanged.
- OpenCCU XML-RPC callbacks and contact automations remain unchanged.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.

## Tests

- Regression coverage verifies automatic re-login and retry for the production `access denied ("GUEST" needed 0)` response.
- Regression coverage verifies that the dedicated thermostat-control client renews a long-lived session before reuse.
- Runtime adapter coverage verifies the same automatic re-authentication behavior for normal OpenCCU synchronization.
- Release-validator coverage enforces renewal and expired-session recovery in both OpenCCU JSON-RPC clients.
- Release validator passed for SALTA v0.8.131.
- JavaScript syntax checks passed.
- TypeScript production build passed.
- Test symbol preflight passed for 100 test files.
- 100 of 100 test files passed.
- 566 of 566 tests passed.
- Final full CI on `main` must pass before tagging.

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
