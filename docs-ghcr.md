# GHCR release

Create and push the semantic version tag:

```bash
git tag -a v0.8.57 -m "SALTA v0.8.57"
git push origin v0.8.57
```

The workflow publishes:

```text
ghcr.io/syschelle/salta:0.8.57
ghcr.io/syschelle/salta:0.8
ghcr.io/syschelle/salta:latest
```

Supported platforms are `linux/amd64` and `linux/arm64`.

Deploy the complete prebuilt-image stack using only `docker-compose.image.yml`. The production SALTA service uses host networking so HomeKit mDNS/HAP advertisements reach the local LAN; PostgreSQL is published only on host loopback at `127.0.0.1:${POSTGRES_HOST_PORT:-5433}`.

**Existing HomeKit users upgrading from a pre-v0.8.41 container must migrate the legacy HAP pairing files before the first v0.8.41-or-later recreate:**

```bash
git pull --ff-only
./migrate-homekit-storage.sh
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

The migration is a one-time compatibility step. v0.8.41 and later store HomeKit pairing state and recovered application runtime settings in the persistent `salta_runtime_data` volume. `update.sh`, when present, runs the migration automatically before recreating the container.

For a new installation without an existing HomeKit pairing:

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

After the fresh installation is running, a password-encrypted full backup from **Settings → Sicherung** can restore the old SALTA application identity, configuration and HomeKit/HAP pairing data. PostgreSQL bootstrap credentials, `SALTA_HEALTH_TOKEN`, `WEB_PORT` and `POSTGRES_HOST_PORT` remain replacement-host deployment values. HomeKit can then be enabled and managed from **Settings → HomeKit**.

For a local source build:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

A GitHub Actions run uses the workflow from the commit referenced by the tag. Push workflow fixes before creating a new tag.
