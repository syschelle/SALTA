# SALTA v0.5.5

SALTA v0.5.5 removes unused compatibility paths and fixes two cleanup issues discovered during a full code audit.

## Reliability fixes

- Fixed `backup.sh` and `restore.sh` so `.env` files containing values with spaces are not executed as shell code
- Added explicit `--env-file .env` handling to backup and restore commands
- Added input validation for missing restore files
- Added a registry hydration path that loads persisted devices without writing them back to PostgreSQL at every startup
- Clears room assignments from the in-memory registry immediately after a room is deleted
- Prevents an in-flight or later Shelly refresh from restoring a deleted room ID and causing a foreign-key error
- Removed legacy automatic room creation from free-form device room names

## Dead-code cleanup

- Removed unreachable thermostat and motion-sensor device paths
- Removed the unused `ui` command source
- Removed unused exported helpers and internal-only type exports
- Removed the test-only RPC detection wrapper and updated parser tests to use the active component detector
- Removed obsolete OpenCCU and deCONZ package keywords
- Removed the redundant direct Pino dependency; Fastify continues to provide the runtime logger
- Marked the npm package as private to prevent accidental publication
- Removed the duplicate `RELEASE_NOTES.md` file
- Enabled TypeScript checks for unused locals and parameters and excluded test sources from the production build output

## Compatibility

- No database schema change
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
0.5.5
0.5
latest
```

## Git tag

```text
v0.5.5
```
