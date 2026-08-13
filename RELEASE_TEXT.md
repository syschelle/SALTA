# SALTA v0.8.36

SALTA v0.8.36 fixes the deployment quality gate after CI incorrectly treated optional shell convenience scripts as mandatory repository files. The standalone Docker Compose deployment remains the authoritative production contract.

## Deployment contract cleanup

- `docker-compose.image.yml` and `.env.example` remain mandatory production release files.
- `install.sh`, `update.sh`, `backup.sh` and `restore.sh` are now treated as optional convenience helpers instead of mandatory CI inputs.
- CI and release verification syntax-check each helper with `sh -n` when it exists, but no longer fail simply because a helper script is absent from the repository checkout.
- This removes the v0.8.34/v0.8.35 early-build failure `Required deployment script is missing`.

## More resilient deployment regression tests

- `deployment-config.test.ts` now requires only the standalone Compose configuration and environment example.
- Existing shell-helper checks are still executed conditionally when the corresponding helper is present.
- Missing optional helpers therefore no longer abort or fail the full Vitest suite.
- The standalone Compose stack, mandatory secret wiring, internal PostgreSQL network and retired-variable checks remain covered.

## Safer version tooling

- `npm run version:set -- <version>` no longer requires `install.sh` to exist.
- When `install.sh` is present, its embedded SALTA version marker is still updated automatically.
- Release validation applies the same optional-helper policy, preventing the versioning and validation tools from disagreeing with CI.

## Production documentation

- Direct Docker Compose commands are now documented as the authoritative installation/update path.
- Optional helper scripts are documented as convenience wrappers only.
- Production operation therefore no longer depends on source-repository helper scripts being tracked.

## Existing functionality retained

- Keeps the compact Overview heating-mode and battery-warning cards.
- Keeps Winter target-mode configuration under Settings.
- Keeps the SALTA-only Summer/Winter switch outside HomeKit.
- Keeps encrypted Pushover battery warnings and the persistent seven-day cooldown.
- Keeps per-device HomeKit publication and SALTA-room inheritance.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No runtime API or persistence format is changed.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.36.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains patched `fast-uri` `3.1.5` and `4.1.2`.
- Retains PostCSS `8.5.23`.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.36
0.8
latest
```

## Git tag

```text
v0.8.36
```
