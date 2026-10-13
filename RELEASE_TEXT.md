# SALTA v0.8.127

SALTA v0.8.127 makes the System Log automation-name accent reliable and significantly reduces redundant GitHub Actions runs without reducing the SALTA test suite.

## Changes

- Automation names in System Log topics always receive dedicated accent markup.
- The automation name uses the same shared `var(--accent)` color as the `DIAGNOSE & FEHLERSUCHE` label.
- Messages that already contain the configured automation name are now split safely so only the automation name receives the accent color.
- Full CI no longer runs automatically for every `work/**` branch push. Automatic full CI remains enabled for `main` and real pull requests, and it can still be started manually.
- Superseded CI runs are cancelled automatically.
- The obsolete repository-specific CodeQL workflow was removed; GitHub's repository-level dynamic code scanning remains separate.
- Release-tag publishing no longer repeats `npm ci` and the full `npm run check` suite. Instead it verifies that the tagged commit belongs to `main`, that the tag matches the package version, and that the release validator passes before the container is built.

## Root Cause

The v0.8.126 source change was present on `main`, but v0.8.126 was never tagged or published. Therefore the published `latest` container remained v0.8.125 and could not contain the color change. In addition, the v0.8.126 rendering helper deliberately skipped dedicated markup when the automation name was already present in the message text, so those messages would still have appeared without the requested accent.

GitHub Actions also performed more work than necessary: full CI ran on every work-branch push, an obsolete repository-specific CodeQL workflow produced configuration-level failures, and the release workflow repeated the complete test suite after the same commit had already passed main CI.

v0.8.127 fixes the rendering path and consolidates quality checks so the complete test suite remains authoritative while redundant executions are removed.

## Compatibility

- No database schema change or migration is required.
- Existing system-log rows and automation definitions remain compatible.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.
- OpenCCU, Shelly, Phoscon, Hue, presence and automation execution behavior are unchanged.

## Tests

- Regression coverage verifies dedicated automation-name markup and the shared accent color.
- Regression coverage now also verifies the branch where the automation name is already contained in the log message.
- Release-validator coverage enforces the automation-name accent contract and the reduced GitHub Actions execution policy.
- Release validator must pass for SALTA v0.8.127.
- JavaScript syntax checks must pass.
- TypeScript production build must pass.
- The complete Vitest suite must pass on `main` before release.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.
