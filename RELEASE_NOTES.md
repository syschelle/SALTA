# SALTA v0.4.33

SALTA v0.4.33 updates the project licensing and release documentation without changing runtime behavior.

## Documentation and Licensing

- Changed the SALTA source-code license from MIT to Apache License 2.0
- Replaced the root `LICENSE` file with the Apache License 2.0 text
- Updated `package.json` and the root package metadata in `package-lock.json` to use the SPDX identifier `Apache-2.0`
- Updated the license section in `README.md`
- Removed the version-tag publishing section from the main README
- Updated version references and release documentation for v0.4.33

## Compatibility

- No application runtime behavior changed
- No database migration is required
- No environment or Docker configuration changes are required
- Existing SALTA v0.4.32 installations can update directly

## Updating

Keep the existing `SALTA_ENCRYPTION_KEY`, administrator credentials and reverse-proxy settings unchanged.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.33
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.33
0.4
latest
```

## Git Tag

```text
v0.4.33
```
