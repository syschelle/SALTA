# SALTA

> **Smart-home Abstraction & Local Transport Architecture**

SALTA is a local-first smart-home control plane with PostgreSQL persistence, a responsive web interface, a REST API, mock devices and an optional HomeKit bridge.

> Your home. Your hardware. Your rules.

## Release status

`v0.2.1` is an early alpha foundation. Real Shelly, deCONZ and OpenCCU adapters are still under development.

## Supported architectures

The GitHub release workflow publishes one multi-architecture container image for:

- `linux/amd64` — Intel and AMD PCs, servers and NAS systems
- `linux/arm64` — Raspberry Pi 5 and other 64-bit ARM systems

Docker automatically pulls the correct image for the host. The normal `docker-compose.yml` works on both architectures.

## Publish the container image

Push a version tag to GitHub:

```bash
git add .
git commit -m "Release SALTA v0.2.1"
git push origin main
git tag -a v0.2.1 -m "SALTA v0.2.1"
git push origin v0.2.1
```

GitHub Actions builds and publishes:

```text
ghcr.io/<github-owner>/<repository>:0.2.1
ghcr.io/<github-owner>/<repository>:0.2
ghcr.io/<github-owner>/<repository>:latest
```

After the first successful workflow run, make the package public under **GitHub → Packages → SALTA → Package settings**, unless you intentionally want a private package.

## Deploy with the prebuilt image

Clone the repository on the target host:

```bash
git clone https://github.com/<github-owner>/<repository>.git
cd <repository>
```

Create the environment file and generated passwords:

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

## Architecture-specific deployment

The universal command is recommended:

```bash
docker compose pull
docker compose up -d
```

To explicitly pin Raspberry Pi 5 / ARM64:

```bash
docker compose -f docker-compose.yml -f docker-compose.arm64.yml pull
docker compose -f docker-compose.yml -f docker-compose.arm64.yml up -d
```

To explicitly pin Intel/AMD x86-64:

```bash
docker compose -f docker-compose.yml -f docker-compose.amd64.yml pull
docker compose -f docker-compose.yml -f docker-compose.amd64.yml up -d
```

## Local development build

For development only, build from source with the optional override:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

Production and Raspberry Pi deployments should use the prebuilt GHCR image instead.

## Status and logs

```bash
docker compose ps
docker compose logs -f salta
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
docker compose up -d
```

SALTA uses host networking so HomeKit mDNS and future local discovery protocols work reliably on Linux. PostgreSQL remains bound to `127.0.0.1`.

## Security

- Replace all placeholder values in `.env`.
- Do not expose SALTA directly to the public internet.
- Use a VPN or a secured TLS reverse proxy for remote access.
- Keep the PostgreSQL port bound to loopback.
- The SALTA container runs as an unprivileged user.

## License

MIT
