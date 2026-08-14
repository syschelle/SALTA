# SALTA v0.8.50

SALTA v0.8.50 replaces the unsuccessful PostgreSQL bridge-network workaround from v0.8.49 with a deterministic host-network topology for both SALTA and PostgreSQL. This removes Docker NAT and host-port publishing from the database connection path while keeping PostgreSQL strictly bound to host loopback.

## Production networking fix

- SALTA continues to use `network_mode: host` so HomeKit HAP/mDNS advertisements can reach the Raspberry Pi LAN directly.
- PostgreSQL now also uses `network_mode: host`.
- PostgreSQL is started explicitly with `listen_addresses=127.0.0.1`.
- PostgreSQL listens on `${POSTGRES_HOST_PORT:-5433}` instead of relying on Docker port publishing.
- SALTA continues to connect to PostgreSQL through `127.0.0.1:${POSTGRES_HOST_PORT:-5433}`.
- No PostgreSQL socket is exposed on a LAN-facing address.
- Docker NAT, `ports:` mappings and custom bridge networking are no longer part of the production database path.

## Healthcheck and regression protection

- Updated the PostgreSQL healthcheck to use `127.0.0.1:${POSTGRES_HOST_PORT:-5433}`.
- Updated deployment tests to require host networking for both SALTA and PostgreSQL.
- Extended release validation to reject PostgreSQL port publishing or reintroduction of the retired internal backend bridge.
- Documented the loopback-only PostgreSQL host-network topology in README and SECURITY documentation.

## Compatibility

- Supersedes the unsuccessful SALTA v0.8.49 bridge-network workaround.
- No database migration is required.
- No HomeKit storage migration is required.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible and must not be deleted during the update.
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

After recreation, both containers use host networking and therefore show no Docker port mappings. PostgreSQL must be visible on host loopback at `127.0.0.1:${POSTGRES_HOST_PORT:-5433}` when checked with `ss`, while SALTA should start normally and connect through the same loopback endpoint.
