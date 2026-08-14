# SALTA v0.8.51

SALTA v0.8.51 provides a clean production Docker topology for HomeKit and PostgreSQL after the previous deployment experiments. SALTA alone uses host networking for reliable HAP/mDNS discovery, while PostgreSQL stays on Docker's standard bridge and is published only to host loopback.

## Clean production Compose topology

- SALTA uses `network_mode: host` for HomeKit HAP/mDNS discovery.
- PostgreSQL uses Docker's normal bridge network.
- PostgreSQL is published only as `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`.
- SALTA connects to PostgreSQL through `127.0.0.1:${POSTGRES_HOST_PORT:-5433}`.
- PostgreSQL is not published on `0.0.0.0` or a LAN-facing address.
- Removed custom production `frontend` / `backend` networks.
- Removed the retired `internal: true` network workaround.
- PostgreSQL no longer uses host networking or custom `listen_addresses` / `port` server overrides.
- The PostgreSQL healthcheck targets its normal container-local endpoint at `127.0.0.1:5432`.

## Deployment regression protection

- Deployment tests require exactly one `network_mode: host` declaration in the production Compose file.
- Release validation requires loopback-only PostgreSQL publishing and the matching SALTA `DATABASE_URL`.
- Release validation rejects the retired PostgreSQL host-network workaround and custom internal networks.

## HomeKit migration path

No HomeKit storage migration is required for installations already running v0.8.41 or newer.

For an installation that was already paired with HomeKit before v0.8.41, the one-time migration helper is:

```text
/opt/SALTA/migrate-homekit-storage.sh
```

Run it before recreating the old SALTA container:

```bash
cd /opt/SALTA
./migrate-homekit-storage.sh
```

The helper migrates legacy HomeKit HAP state from `/app/persist` in the old container to the persistent `salta_runtime_data` volume mounted at `/var/lib/salta/homekit`. Runtime settings are stored at `/var/lib/salta/runtime/settings.json`.

## Compatibility

- Supersedes the unreleased v0.8.49/v0.8.50 deployment candidates.
- No database migration is required.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- Do not use `down -v` during the update.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.

## Production update

Use the updated `docker-compose.image.yml` from this release:

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

After recreation, `salta` should use host networking and show no Docker port mappings. `salta-postgres` should show a loopback-only mapping similar to `127.0.0.1:5433->5432/tcp`.
