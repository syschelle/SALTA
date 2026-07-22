# SALTA

> **Smart-home Abstraction & Local Transport Architecture**

SALTA is a local-first smart-home control plane with PostgreSQL persistence, a responsive web interface, a REST API and an optional HomeKit bridge.

> Your home. Your hardware. Your rules.

## Release status

`v0.4.25` is the current stable release. It moves the device title beside the icon for a more compact device-card header.

## Supported architectures

The GitHub release workflow publishes one multi-architecture container image for:

- `linux/amd64` — Intel and AMD PCs, servers and NAS systems
- `linux/arm64` — Raspberry Pi 5 and other 64-bit ARM systems

Docker automatically pulls the correct image for the host. The same `docker-compose.image.yml` override works on both architectures.

## Publish the container image

Push a version tag to GitHub:

```bash
git add .
git commit -m "release: SALTA v0.4.25"
git push origin main
git tag -a v0.4.25 -m "SALTA v0.4.25"
git push origin v0.4.25
```

GitHub Actions builds and publishes:

```text
ghcr.io/<github-owner>/<repository>:0.4.25
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

SALTA is then available at:

```text
http://<docker-host>:8099
```

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
curl http://localhost:8099/api/health
```

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

HomeKit is disabled by default. Enable it in `.env`:

```env
HOMEKIT_ENABLED=true
HOMEKIT_NAME=SALTA Bridge
HOMEKIT_PIN=031-45-154
HOMEKIT_PORT=51826
```

Then restart:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d
```

SALTA uses host networking so HomeKit mDNS and future local discovery protocols work reliably on Linux. PostgreSQL remains bound to `127.0.0.1`.

## Security

- Replace all placeholder values in `.env`.
- Do not expose SALTA directly to the public internet.
- Use a VPN or a secured TLS reverse proxy for remote access.
- Keep the PostgreSQL port bound to loopback.
- The SALTA container runs as an unprivileged user.

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
