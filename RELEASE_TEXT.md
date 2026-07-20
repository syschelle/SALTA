# SALTA v0.4.6

SALTA v0.4.6 simplifies Docker deployment by replacing separate ARM64 and AMD64 Compose overrides with one unified multi-architecture image configuration.

Docker automatically selects the correct image variant for the host, so Raspberry Pi, Intel and AMD systems now use the same deployment commands.

## Highlights

- Added `docker-compose.image.yml` for prebuilt GHCR images
- Removed `docker-compose.arm64.yml`
- Removed `docker-compose.amd64.yml`
- Unified deployment commands across supported architectures
- Updated deployment, update, backup and restore scripts
- Updated Docker and GHCR documentation

## Docker Compose Structure

Production image deployment now uses:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d
```

Local source builds continue to use:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

No architecture-specific Compose file is required. The published image manifest contains both supported platforms, and Docker selects the matching variant automatically.

## Supported Platforms

- `linux/amd64`
- `linux/arm64`

## Updating

No database migration is required.

Existing `.env` files remain compatible. To pin this release explicitly, set:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.6
```

Then run:

```bash
./update.sh
```

## Quality Assurance

The TypeScript strict type check, automated tests and production build completed successfully before packaging.

## Container Tags

```text
0.4.6
0.4
latest
```

## Git Tag

```text
v0.4.6
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
