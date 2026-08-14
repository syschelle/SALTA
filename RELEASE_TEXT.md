# SALTA v0.8.49

SALTA v0.8.49 fixes the production Docker networking topology used by the HomeKit-capable deployment. In v0.8.48, SALTA correctly used host networking for HAP/mDNS, but PostgreSQL was still attached to the custom `internal: true` backend bridge while SALTA tried to reach PostgreSQL through the host-loopback publication on port 5433. On the affected production deployment this resulted in PostgreSQL being healthy while SALTA restarted with `ECONNREFUSED 127.0.0.1:5433`.

## Production networking fix

- Removed the custom `internal: true` backend network from the production `docker-compose.image.yml`.
- PostgreSQL now uses Docker's normal bridge networking.
- PostgreSQL remains published **only** on host loopback at `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`.
- SALTA continues to use `network_mode: host` so HomeKit HAP/mDNS advertisements can reach the local LAN directly.
- SALTA continues to connect to PostgreSQL through `127.0.0.1:${POSTGRES_HOST_PORT:-5433}`.
- No PostgreSQL port is exposed on a LAN-facing host address.

## Deployment regression protection

- Updated the production deployment test to require HomeKit host networking and loopback-only PostgreSQL without an internal backend bridge.
- Extended release validation to reject `internal: true` in the production Compose topology used for PostgreSQL.
- Extended release validation to reject attaching production PostgreSQL to the retired `backend` network while SALTA uses host networking.
- Updated README and security documentation to describe the corrected topology.

## Compatibility

- Builds on SALTA v0.8.48.
- No database migration is required.
- No HomeKit storage migration is required.
- Existing PostgreSQL and `salta_runtime_data` volumes remain compatible and must not be deleted during the update.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.

## Production update

Use the updated `docker-compose.image.yml` from this release, then recreate the stack without deleting volumes:

```bash
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

After recreation, PostgreSQL should show a loopback-only mapping similar to `127.0.0.1:5433->5432/tcp`, while the SALTA container should use host networking and therefore show no Docker port mappings of its own.
