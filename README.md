# SALTA

> **Smart-home Abstraction & Local Transport Architecture**

SALTA is a local-first smart-home control plane with PostgreSQL persistence, a responsive web interface, a REST API and an optional HomeKit bridge.

> Your home. Your hardware. Your rules.

## Supported architectures

The GitHub release workflow publishes one multi-architecture image for:

- `linux/amd64`
- `linux/arm64`

Docker automatically pulls the correct image for the host.

## Hardware for a dedicated SALTA system

SALTA does not require a powerful server when it is the only application running on the host.

### Recommended setup

- Raspberry Pi 4 with 4 GB RAM
- 64 GB or 128 GB USB SSD
- Gigabit Ethernet
- Official or high-quality power supply
- Small cooled case
- 64-bit Raspberry Pi OS Lite or another supported 64-bit Linux distribution

A Raspberry Pi 4 with 2 GB RAM is generally sufficient for SALTA alone, but 4 GB provides more reserve for operating-system updates, Docker operations and growing PostgreSQL data.

### Practical minimum

- 64-bit ARM64 or AMD64 processor with at least two CPU cores
- 2 GB RAM
- 32 GB SSD storage
- Wired Ethernet connection
- 64-bit Linux with Docker Engine and the Docker Compose plugin

Use an SSD for the PostgreSQL data volume. A microSD card is suitable for testing, but it is not recommended as the primary storage medium for continuous operation.

A Raspberry Pi 5 or an Intel N100/N150 mini PC also works, but it is not necessary when the system runs only SALTA.

## Installation

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
- validates the standalone production Compose configuration;
- pulls the container image configured by `SALTA_IMAGE`;
- starts PostgreSQL and SALTA;
- prints the generated administrator login once.

The generated `.env` publishes SALTA to the local network by default:

```env
WEB_PORT=8099
SALTA_BIND_ADDRESS=0.0.0.0
```

The repository's `.env.example` pins `SALTA_IMAGE` to the matching release. Keep a fixed image tag for predictable deployments, or deliberately change it when updating.

Open SALTA at:

```text
http://IP-OF-THE-SALTA-HOST:8099
```

Authentication cannot be disabled.

## Reset or reinstall

A reset permanently deletes the SALTA PostgreSQL volume and all SALTA configuration stored in it. Shelly devices themselves are not modified.

For a completely fresh installation, including a new database and newly generated secrets:

```bash
./install.sh --fresh
```

To reset only the database while retaining the existing `.env` values:

```bash
./install.sh --reset
```

Use `--fresh` when the existing installation should be discarded completely. Use `--reset` when the current passwords, encryption key and other environment settings should remain unchanged.

## Manual image deployment

`docker-compose.image.yml` contains the complete production stack: PostgreSQL, SALTA, volumes, networks, health checks, security settings, port mappings and all required environment-variable wiring. No additional Compose file is required.

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Local development build

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## Status and logs

```bash
docker compose --env-file .env -f docker-compose.image.yml ps
docker compose --env-file .env -f docker-compose.image.yml logs -f salta
```

The internal Docker health endpoint requires the generated `SALTA_HEALTH_TOKEN` and is not publicly accessible without it.

## Updating

```bash
./update.sh
```

The update script validates the existing `.env`, pulls repository and image changes and recreates the containers. Review the release notes before updating when a release announces configuration or database compatibility changes.

## Backup and restore

```bash
./backup.sh
./restore.sh backups/salta-YYYYMMDD-HHMMSS.dump
```

Restore only backups created with a compatible SALTA database schema. Keep backups outside the SALTA system disk whenever possible.

## Security

SALTA is fail-closed. A strong administrator password, a health token and an encryption key are mandatory. Browser access uses an opaque server-side session, an `HttpOnly` and `SameSite=Strict` cookie, CSRF protection and finite session lifetimes.

SALTA does not terminate TLS. Direct HTTP access is supported for trusted local networks but is unencrypted; Internet-facing or otherwise untrusted access must use an HTTPS reverse proxy. Configure `TRUSTED_PROXIES` with only the exact proxy IP address or required CIDR so SALTA can recognize HTTPS and set the `Secure` cookie attribute and HSTS correctly.

Direct Basic-authenticated API access is accepted only from `LOCAL_NETWORKS` and only without forwarded proxy headers. Basic authentication is not encrypted by itself, so it should be used through HTTPS and with narrowly configured local networks.

PostgreSQL is available only on the internal Docker network. The SALTA container drops all Linux capabilities, enables `no-new-privileges`, limits its process count and uses a writable, size-limited `/tmp` with `noexec` and `nosuid`. Application rate limits and login blocks are held in process memory, reset on restart and do not replace firewall or reverse-proxy protection.

See `SECURITY.md` for the exact behavior, configuration guidance and limitations.

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

Passwords are stored as `v2` AES-256-GCM values using a per-secret random salt and a `scrypt`-derived key. Removed legacy credential formats are not accepted.

## Phoscon and Zigbee support

SALTA can connect to one local Phoscon/deCONZ instance through its REST API. Configure the connection under **Settings → Phoscon / Zigbee** using the gateway base address and either an existing API key or the guided app-pairing workflow.

For automatic pairing, temporarily enable third-party app authentication in the Phoscon gateway settings and request the API key from SALTA within the displayed authorization window. The key is encrypted in PostgreSQL with `SALTA_ENCRYPTION_KEY` and is never returned to the browser after it has been stored.

The Zigbee page is separate from the Shelly page and imports supported resources from Phoscon:

- lights and dimmable lights;
- smart plugs and other on/off actuators;
- window coverings;
- motion, contact, temperature, humidity, light, water, smoke and button sensors; and
- power and energy measurements exposed by deCONZ.

Multiple deCONZ sensor resources belonging to the same physical Zigbee device are combined into one SALTA card. Metering or battery resources that belong to one unambiguous actuator are merged into that actuator instead of being shown as duplicate devices.

SALTA can switch supported lights and plugs, set brightness and control compatible window coverings. Sensor resources are read-only. Names and room assignments are managed locally in SALTA; disconnecting Phoscon removes the synchronized SALTA records but does not delete or reset devices in Phoscon.

## Rooms

Rooms are first-class database entities linked to devices by `room_id`. The obsolete duplicate room-name column and its synchronization logic have been removed.

## Icons

SALTA bundles Material Design Icons (MDI) by Pictogrammers locally. No icon CDN is used at runtime. The bundled icon assets are provided under the Apache License 2.0; see `public/vendor/mdi/LICENSE`.

## License

SALTA source code: Apache License 2.0. See `LICENSE`.

Bundled Material Design Icons: Apache License 2.0. See `public/vendor/mdi/LICENSE`.
