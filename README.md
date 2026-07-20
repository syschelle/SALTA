# SALTA

> **Smart-home Abstraction & Local Transport Architecture**

SALTA is a local-first smart-home integration platform. The current `v0.1.0` release is a deployable prototype with a modern web dashboard, PostgreSQL persistence, mock devices, a REST API and optional Apple HomeKit publication.

> Your home. Your hardware. Your rules.

## Current status

This is an early public prototype. It demonstrates SALTA's architecture and deployment model. Real Shelly, deCONZ and OpenCCU adapters are planned, but are not included in `v0.1.0`.

Included mock devices:

- Shelly Plug S-style outlet
- Shelly 1-style switch
- Shelly 3EM-style energy meter
- Shelly 2PM Gen4-style shutter
- Classic HomeMatic-style thermostat
- deCONZ-style Zigbee light
- deCONZ-style motion sensor

## Requirements

- A Linux host
- Docker Engine
- Docker Compose plugin
- Ports `8099` and optionally `51826` available

Native Linux is recommended because later integrations require HomeKit mDNS, Shelly CoIoT and OpenCCU callback traffic.

## One-command deployment

```bash
./deploy.sh
```

The script:

- creates `.env` on the first run
- generates random PostgreSQL and web passwords
- builds the SALTA image
- starts PostgreSQL and SALTA
- prints the web address and initial login

Open:

```text
http://<docker-host>:8099
```

## Manual deployment

```bash
cp .env.example .env
```

Replace both `CHANGE_ME` values in `.env`, then run:

```bash
docker compose up -d --build
```

Check the deployment:

```bash
docker compose ps
docker compose logs -f salta
curl http://localhost:8099/api/health
```

## Updating

```bash
./update.sh
```

## Backup

```bash
./backup.sh
```

Backups are written to the local `backups/` directory in PostgreSQL custom format.

## Restore

```bash
./restore.sh backups/salta-YYYYMMDD-HHMMSS.dump
```

Restoring replaces matching database objects. Create a fresh backup first.

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

The SALTA application uses host networking so HomeKit and future local discovery protocols can work reliably on Linux. PostgreSQL remains bound to `127.0.0.1` only.

## API

Public health endpoints:

```text
GET /api/health
GET /api/readiness
```

Authenticated endpoints:

```text
GET   /api/devices
GET   /api/devices/:id
PATCH /api/devices/:id/config
POST  /api/devices/:id/command
GET   /api/commands
GET   /api/adapters
POST  /api/adapters/mock/reconcile
```

Example:

```bash
curl -u admin:'YOUR_PASSWORD' \
  -X POST http://localhost:8099/api/devices/mock:plug-s:office/command \
  -H 'content-type: application/json' \
  -d '{"capability":"toggle"}'
```

## Architecture

```text
Apple Home (optional)
        │
   HomeKit bridge
        │
┌───────┴────────────────────────────┐
│              SALTA                 │
│ Device registry · REST API · UI    │
│ Commands · Adapter abstraction     │
└───────────────┬────────────────────┘
                │
          Mock adapter
                │
           PostgreSQL
```

## Security

- The dashboard and control API use HTTP Basic authentication when `ADMIN_PASSWORD` is set.
- `deploy.sh` generates passwords automatically.
- PostgreSQL is exposed only on the Docker host loopback interface.
- The container runs as an unprivileged user and enables `no-new-privileges`.
- Do not expose SALTA directly to the public internet.
- For access outside the LAN, use a VPN such as WireGuard or Tailscale, or a properly secured reverse proxy with TLS.

Basic authentication is suitable for a trusted LAN prototype but should be replaced by session-based authentication before broader production use.

## Repository release

To create the first GitHub release:

```bash
git add .
git commit -m "Release SALTA v0.1.0 prototype"
git branch -M main
git remote add origin git@github.com:YOUR_ACCOUNT/salta.git
git push -u origin main
git tag -a v0.1.0 -m "SALTA v0.1.0"
git push origin v0.1.0
```

Pushing the tag runs the included GitHub Actions workflow and publishes multi-platform container images to GitHub Container Registry:

```text
ghcr.io/YOUR_ACCOUNT/salta:0.1.0
ghcr.io/YOUR_ACCOUNT/salta:latest
```

## Roadmap

- Shelly Gen 1 HTTP and CoIoT adapter
- Shelly RPC and WebSocket adapter
- Shelly 2PM Gen4 cover support
- Phoscon/deCONZ REST and WebSocket adapter
- OpenCCU BidCos-RF XML-RPC adapter
- Persistent HomeKit pairing storage hardening
- Local automation engine
- Session-based web authentication
- Audit and diagnostics views

## License

MIT
