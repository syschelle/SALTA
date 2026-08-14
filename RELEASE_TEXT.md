# SALTA v0.8.52

SALTA v0.8.52 provides a release-consistent production deployment package after the unreleased v0.8.51 candidate. The production Compose topology, deployment tests, release validator, migration documentation and release metadata are aligned to the same verified state before the repository is tagged.

## Clean production Compose topology

- SALTA uses `network_mode: host` for HomeKit HAP/mDNS discovery.
- PostgreSQL uses Docker's normal bridge network.
- PostgreSQL is published only as `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`.
- SALTA connects to PostgreSQL through `127.0.0.1:${POSTGRES_HOST_PORT:-5433}`.
- PostgreSQL is not published on `0.0.0.0` or a LAN-facing address.
- No custom production `frontend` / `backend` networks are defined.
- No `internal: true` network workaround is used.
- PostgreSQL does not use host networking or custom `listen_addresses` / `port` server overrides.
- The PostgreSQL healthcheck targets its normal container-local endpoint at `127.0.0.1:5432`.

## Release consistency and verification

- Added `RELEASE_MANIFEST.md` with SHA-256 fingerprints for the exact production Compose file and HomeKit migration helper.
- Release validation checks the manifest against the files in the release tree.
- Deployment tests validate the same topology as the production Compose file.
- The release is intended to be pushed first, verified against `origin/main`, and only then tagged.

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

- Supersedes the unreleased v0.8.51 deployment candidate.
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
