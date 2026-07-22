# SALTA

> **Smart-home Abstraction & Local Transport Architecture**

SALTA is a local-first smart-home control plane with PostgreSQL persistence, a responsive web interface, a REST API and an optional HomeKit bridge.

> Your home. Your hardware. Your rules.

## Release status

`v0.5.2` is the current stable release. It introduces a clean-install architecture and removes SALTA-owned legacy migration and compatibility paths.

> **Breaking change:** v0.5.2 requires a fresh PostgreSQL volume. Databases and encrypted credentials from v0.4.x are intentionally not migrated.

## Supported architectures

The GitHub release workflow publishes one multi-architecture image for:

- `linux/amd64`
- `linux/arm64`

Docker automatically pulls the correct image for the host.

## Fresh installation

Clone the repository and run the installer:

```bash
git clone https://github.com/syschelle/SALTA.git
cd SALTA
chmod +x install.sh update.sh backup.sh restore.sh
./install.sh
```

`install.sh` performs the complete installation in one run:

- creates `.env` when it does not exist;
- generates the PostgreSQL password, administrator password, health token and encryption key;
- validates the merged Compose configuration;
- pulls `ghcr.io/syschelle/salta:0.5.2`;
- starts PostgreSQL and SALTA;
- prints the generated administrator login once.

The default `.env.example` publishes SALTA to the local network:

```env
WEB_PORT=8099
SALTA_BIND_ADDRESS=0.0.0.0
SALTA_IMAGE=ghcr.io/syschelle/salta:0.5.2
```

Open SALTA at:

```text
http://IP-OF-THE-SALTA-HOST:8099
```

Authentication cannot be disabled.

## Clean reinstall from v0.4.x

A clean reinstall permanently deletes the SALTA PostgreSQL volume and all SALTA configuration stored in it. Shelly devices themselves are not modified.

For a completely fresh installation, including a new database and newly generated secrets:

```bash
./install.sh --fresh
```

To reset only the database while retaining the existing `.env` values:

```bash
./install.sh --reset
```

The installer detects unversioned v0.4.x volumes and refuses to start against them. This prevents an old schema from being used accidentally.

## Manual image deployment

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Local development build

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## Status and logs

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.image.yml ps
docker compose --env-file .env -f docker-compose.yml -f docker-compose.image.yml logs -f salta
```

The internal Docker health endpoint requires the generated `SALTA_HEALTH_TOKEN` and is not publicly accessible without it.

## Updating within the v0.5 line

```bash
./update.sh
```

The update script validates the existing `.env`, pulls repository and image changes and recreates the containers. It no longer edits old environment files or inserts compatibility variables.

## Backup and restore

```bash
./backup.sh
./restore.sh backups/salta-YYYYMMDD-HHMMSS.dump
```

Only restore backups created from the compatible v0.5 database schema.

## Security

SALTA is fail-closed. A strong administrator password, a health token and an encryption key are mandatory. Browser access uses an opaque server-side session, `HttpOnly` cookies, CSRF protection and finite session lifetimes.

Direct Basic-authenticated API access is accepted only from `LOCAL_NETWORKS`. When a reverse proxy is used, configure `TRUSTED_PROXIES` with its exact IP address or CIDR.

PostgreSQL is available only on the internal Docker network. The SALTA container drops all Linux capabilities, enables `no-new-privileges`, uses a read-limited temporary filesystem and applies application-level rate limiting.

See `SECURITY.md` for details.

## HomeKit

HomeKit is disabled by default. Enable it in `.env` when required. Depending on the Docker host, multicast discovery may require an mDNS reflector or a dedicated LAN/macvlan setup.

SALTA-owned deprecated dependencies have been removed. The HomeKit library still carries one deprecated transitive upstream package through its persistence layer; it is documented in `DEPENDENCY_NOTES.md` and retained to avoid silently breaking HomeKit.

## Shelly support

SALTA supports Shelly Gen1 REST devices and Gen2, Gen3 and Gen4 RPC devices. Detection records model, generation, firmware, hostname, address, MAC address, channel count and supported functions.

Compatible multi-channel and 2PM devices are represented according to their active switch or cover profile. Supported on/off devices can be presented as Automatic, Light, Switch, Outlet or Fan without changing the physical command routing.

Shelly authentication supports:

- `inherit`: use the global Shelly credentials;
- `custom`: use encrypted credentials stored for one device;
- `none`: connect without authentication.

Passwords are stored as `v2` AES-256-GCM values using a per-secret random salt and a `scrypt`-derived key. The removed v1 compatibility format is not accepted by v0.5.2.

## Rooms

Rooms are first-class database entities linked to devices by `room_id`. The obsolete duplicate room-name column and its synchronization logic have been removed.

## Icons

SALTA bundles Material Design Icons (MDI) by Pictogrammers locally. No icon CDN is used at runtime. The bundled icon assets are provided under the Apache License 2.0; see `public/vendor/mdi/LICENSE`.

## License

SALTA source code: Apache License 2.0. See `LICENSE`.

Bundled Material Design Icons: Apache License 2.0. See `public/vendor/mdi/LICENSE`.
