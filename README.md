# SALTA

> **Smart-home Abstraction & Local Transport Architecture**

SALTA is a local-first smart-home control plane with PostgreSQL persistence, a responsive web interface, a REST API and an optional HomeKit bridge.

> Your home. Your hardware. Your rules.

## Release status

`v0.4.29` is the current stable release. It fixes the TypeScript compilation of the security-enabled Fastify server tests while retaining the v0.4.28 hardening.

## Supported architectures

The GitHub release workflow publishes one multi-architecture container image for:

- `linux/amd64` — Intel and AMD PCs, servers and NAS systems
- `linux/arm64` — Raspberry Pi 5 and other 64-bit ARM systems

Docker automatically pulls the correct image for the host. The same `docker-compose.image.yml` override works on both architectures.

## Publish the container image

Push a version tag to GitHub:

```bash
git add .
git commit -m "release: SALTA v0.4.29"
git push origin main
git tag -a v0.4.29 -m "SALTA v0.4.29"
git push origin v0.4.29
```

GitHub Actions builds and publishes:

```text
ghcr.io/<github-owner>/<repository>:0.4.29
ghcr.io/<github-owner>/<repository>:0.4
ghcr.io/<github-owner>/<repository>:latest
```

After the first successful workflow run, make the package public under **GitHub → Packages → SALTA → Package settings**, unless you intentionally want a private package.

## Deploy with the prebuilt image

Clone the repository on the target host:

```bash
git clone https://github.com/<github-owner>/<repository>.git
cd <repository>
```

Create the environment file with generated database, administrator and encryption credentials:

```bash
chmod +x deploy.sh update.sh backup.sh restore.sh
./deploy.sh
```

On the first run, `deploy.sh` creates `.env` and stops so you can set the image path:

```env
SALTA_IMAGE=ghcr.io/<github-owner>/<repository>:latest
```

Run it again:

```bash
./deploy.sh
```

SALTA is then available locally at:

```text
http://127.0.0.1:8099
```

The first request opens the SALTA login page. Authentication cannot be disabled.

No Node.js, npm or local application build is required on the deployment host.

## Multi-architecture image deployment

Use the common Compose definition together with the image override:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d
```

No architecture-specific Compose file is required. Docker automatically selects the `linux/amd64` or `linux/arm64` image variant that matches the host.

## Local development build

For development only, build from source with the optional override:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

Production and Raspberry Pi deployments should use the prebuilt GHCR image instead.


## Appearance

The sidebar includes a live light/dark theme switch. The selected theme is applied immediately and stored in the functional `salta_theme` cookie for one year, so the web interface restores the preference before rendering on the next visit. The preference remains local to the browser and is not stored in PostgreSQL.

## Icons

SALTA bundles [Material Design Icons (MDI)](https://pictogrammers.com/library/mdi/) locally from Pictogrammers `@mdi/font` 7.4.47. No icon CDN or external runtime request is used. The bundled icon font is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0); see `public/vendor/mdi/LICENSE`. Room icons are selected from a curated list in the web interface; no MDI identifier needs to be entered manually.

## Status and logs

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml ps
docker compose -f docker-compose.yml -f docker-compose.image.yml logs -f salta
curl -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" http://127.0.0.1:8099/api/health
```

The unauthenticated Docker health endpoint is not public: it requires the generated `SALTA_HEALTH_TOKEN`.

## Updating

```bash
./update.sh
```

The update script pulls repository changes and the newest configured container image without rebuilding locally.

## Backup and restore

```bash
./backup.sh
./restore.sh backups/salta-YYYYMMDD-HHMMSS.dump
```

## HomeKit

HomeKit is disabled by default. Enable it in `.env` and publish the configured HAP port when required. SALTA now runs on Docker bridge networks so PostgreSQL can remain isolated. Depending on the Docker host, HomeKit multicast discovery may require an mDNS reflector or a dedicated LAN/macvlan setup.

## Security

SALTA v0.4.29 is fail-closed: a strong `ADMIN_PASSWORD` and generated `SALTA_HEALTH_TOKEN` are mandatory. The web application uses an opaque server-side session with an `HttpOnly`, `SameSite=Strict` cookie, a finite lifetime, logout support and CSRF protection for state-changing requests.

Direct Basic-authenticated API access is accepted only from `LOCAL_NETWORKS`. Internet browser access uses the authenticated same-origin web session. This is necessary because the browser interface itself retrieves data through JSON endpoints.

For reverse proxies, configure `TRUSTED_PROXIES` with the exact proxy IP or CIDR. Do not use a blanket trust setting. HTTPS is required for Internet exposure so session cookies receive the `Secure` attribute and HSTS can be emitted.

SALTA also applies security headers, request/body/header timeouts, per-client and global rate limits, stricter limits for login and expensive discovery calls, and structured warnings when limits are exceeded. These controls mitigate application-layer abuse; they cannot absorb a volumetric attack that saturates the Internet connection.

Docker networking uses two networks:

- `frontend`: SALTA web traffic and outbound access to local Shelly devices
- `backend`: an `internal: true` network shared only by SALTA and PostgreSQL

PostgreSQL has no published host port. The SALTA container runs unprivileged with all Linux capabilities dropped and `no-new-privileges` enabled.

See `SECURITY.md` for deployment details.

## License

SALTA source code: MIT.

Bundled Material Design Icons: Apache License 2.0. See `public/vendor/mdi/LICENSE`.

## Shelly support

SALTA supports Shelly Gen1 REST devices and Gen2, Gen3 and Gen4 RPC devices. Device detection records the model, generation, firmware, hostname, address, MAC address, channel count and supported functions. Depending on the device, the dashboard displays switch or cover state together with available power, energy, voltage, current, frequency and temperature values.

### Multi-profile and multi-channel devices

For compatible Shelly 2PM devices, SALTA reads the active `switch` or `cover` profile. In switch profile, each switch component is registered as an independent device card and can be renamed separately. In cover profile, the paired outputs are represented as one window-covering device. Channel names configured on the Shelly are imported when available.

### Configurable device functions

Compatible on/off devices can be presented as **Automatic**, **Light**, **Switch**, **Outlet** or **Fan** from the device configuration dialog. The physical Shelly type, component ID, measurements and command routing remain unchanged. The selected function controls the SALTA card icon and label as well as the HomeKit service type. Existing devices remain in Automatic mode until changed.

## Device removal

Shelly devices can be removed from their configuration dialog. The action deletes the SALTA device record, stored device credentials, related command history and the corresponding HomeKit accessory. The physical Shelly device remains unchanged and can be added again later.

## Rooms and credentials

Rooms are first-class entities. Devices can be assigned to rooms, while unassigned devices remain visible under **Nicht zugeordnet**. Renaming a room updates all assigned device cards immediately.

Shelly authentication supports three modes:

- `inherit`: use the global Shelly username and password
- `custom`: use encrypted credentials stored for the device
- `none`: connect without authentication

Passwords are encrypted with AES-256-GCM before being stored in PostgreSQL. New secrets use a per-secret random salt and a `scrypt`-derived 256-bit key; existing v1 secrets are upgraded automatically when the configured key can decrypt them. SALTA validates stored credentials at startup and in `/api/readiness`, and the web interface warns before global credentials are used when the current `SALTA_ENCRYPTION_KEY` does not match. Keep this key stable and include `.env` in secure backups. Password values are never returned by the REST API.
