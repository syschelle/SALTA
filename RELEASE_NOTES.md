# SALTA v0.4.6

SALTA v0.4.6 simplifies container deployment by replacing the architecture-specific Compose overrides with one multi-architecture image override.

## Highlights

- Added `docker-compose.image.yml` for GHCR image deployments
- Removed `docker-compose.arm64.yml`
- Removed `docker-compose.amd64.yml`
- Docker now selects the matching `linux/amd64` or `linux/arm64` image automatically
- Updated deployment, update, backup and restore scripts to use the image override
- Updated documentation and examples for the unified Compose workflow

## Compatibility

No database migration is required. Existing `.env` files remain compatible. The `SALTA_IMAGE` variable can continue to pin a specific version such as `ghcr.io/syschelle/salta:0.4.6`.

## Publishing

Pushing the Git tag `v0.4.6` triggers the `Publish SALTA container` GitHub Actions workflow. The workflow publishes multi-architecture images for `linux/amd64` and `linux/arm64` with the tags `0.4.6`, `0.4` and `latest`.
