# SALTA v0.5.2

SALTA v0.5.2 fixes the documentation attribution regression that caused the frontend icon test to fail during the release build.

## Build fix

- Restored the full Material Design Icons attribution in `README.md`
- Documented the official name `Material Design Icons (MDI)`
- Added the upstream project attribution to Pictogrammers
- Retained the Apache License 2.0 reference and the bundled license-file path
- Revalidated the README against the frontend icon regression test

## Runtime behavior

- No SALTA runtime behavior changed
- No API behavior changed
- No database schema changed compared with v0.5.0 and v0.5.1
- The v0.5 clean-install architecture remains unchanged

## Important compatibility notice

SALTA v0.5.2 requires a fresh PostgreSQL volume when upgrading from v0.4.x. Existing v0.4.x databases and v1-encrypted credentials are intentionally not migrated.

For a complete fresh installation:

```bash
./install.sh --fresh
```

For a database-only reset that retains the current `.env` secrets:

```bash
./install.sh --reset
```

## Container tags

```text
0.5.2
0.5
latest
```

## Git tag

```text
v0.5.2
```
