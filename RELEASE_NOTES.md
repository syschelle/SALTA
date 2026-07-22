# SALTA v0.4.30

SALTA v0.4.30 republishes the unchanged v0.4.29 application code under a new release tag to trigger a fresh GitHub container build.

## Release Scope

- No runtime behavior changes
- No security-policy changes
- No database migration
- No environment-variable changes
- Includes all authentication, API protection, rate limiting and Docker-network hardening from v0.4.29
- Uses a new Git tag so the container publishing workflow runs again

## Important Note

This release does not change GitHub's repository-level CodeQL default configuration. A separate CodeQL configuration error may still be shown by GitHub even when the SALTA container build and publication succeed.

## Updating

Keep the existing `SALTA_ENCRYPTION_KEY`, admin credentials and security settings unchanged.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.30
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.30
0.4
latest
```

## Git Tag

```text
v0.4.30
```
