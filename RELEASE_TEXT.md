# SALTA v0.5.6

SALTA v0.5.6 makes `docker-compose.image.yml` a complete standalone production deployment.

## Standalone production deployment

- Expanded `docker-compose.image.yml` to include the complete PostgreSQL and SALTA stack
- Included persistent PostgreSQL storage, frontend and internal backend networks, service dependencies and health checks
- Included all SALTA and PostgreSQL environment-variable mappings and mandatory secret validation
- Included SALTA web and optional HomeKit port mappings
- Included the existing container security settings, capability drop, process limit and size-limited temporary filesystem
- Updated installation, update, backup and restore scripts to use only `docker-compose.image.yml`
- Updated production deployment, status and log commands throughout the documentation
- Added regression coverage that verifies the image deployment file is self-contained

## Deployment

Only the environment file and the standalone Compose file are required:

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

Status and logs:

```bash
docker compose --env-file .env -f docker-compose.image.yml ps
docker compose --env-file .env -f docker-compose.image.yml logs -f salta
```

## Compatibility

- No application runtime behavior changed
- No API behavior changed
- No database schema changed
- No `.env` migration is required
- No fresh installation is required when updating from v0.5.x
- The clean-install requirement still applies when coming from v0.4.x

## Updating

```bash
./update.sh
```

For a new installation:

```bash
./install.sh --fresh
```

## Container tags

```text
0.5.6
0.5
latest
```

## Git tag

```text
v0.5.6
```
