# SALTA v0.5.0

SALTA v0.5.0 introduces a clean-install architecture and removes legacy compatibility code that was carried forward from earlier releases.

## Clean installation

- Added a one-step `install.sh` workflow that creates all required secrets and starts SALTA immediately
- Added `./install.sh --fresh` for a complete reinstall with a new database and newly generated secrets
- Added `./install.sh --reset` for a database-only reset that retains the existing `.env`
- Set the default image to `ghcr.io/syschelle/salta:0.5.0`
- Set the default web bind address to `0.0.0.0` for direct local-network access
- Added explicit `--env-file .env` handling to installation and update commands
- Added a Docker volume schema label so legacy database volumes are detected before startup

## Removed legacy paths

- Removed incremental `ALTER TABLE` database migration statements
- Removed the v0.4 room-name migration and mock-device cleanup path
- Removed the duplicate legacy `devices.room` database column
- Removed v1 secret decryption and automatic v1-to-v2 credential conversion
- Removed compatibility edits from `update.sh`
- Replaced the two-step `deploy.sh` process with the one-step `install.sh`
- Removed the obsolete v0.3 roadmap document
- Replaced the direct `@fastify/static` dependency with an allow-listed native static-file handler
- Removed the obsolete `glob` dependency chain from the lockfile

## Database model

- Added an explicit SALTA schema metadata table
- Added startup validation for the v0.5 schema generation
- Kept the final database schema in one canonical initialization definition
- Continued to store credentials with salted, scrypt-derived AES-256-GCM encryption

## Dependency note

No SALTA direct dependency is marked as deprecated. The HomeKit library still includes a deprecated transitive `q` package through its upstream persistence dependency. It remains in this release to preserve HomeKit support and is documented in `DEPENDENCY_NOTES.md`.

## Important compatibility notice

SALTA v0.5.0 requires a fresh PostgreSQL volume. Existing v0.4.x databases and v1-encrypted credentials are not migrated. Back up any information that must be retained, then perform a clean reinstall.

```bash
./install.sh --fresh
```

To retain the existing application secrets while resetting only the database:

```bash
./install.sh --reset
```

## Container tags

```text
0.5.0
0.5
latest
```

## Git tag

```text
v0.5.0
```
