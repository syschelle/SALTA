# SALTA v0.5.1

SALTA v0.5.1 fixes the container build failure introduced by the dependency lockfile cleanup in v0.5.0.

## Build fix

- Restored the nested `fast-uri@4.1.1` package required by `fast-json-stringify`
- Restored the nested `process-warning@4.0.1` package required by `light-my-request`
- Restored the npm registry URL and SHA-512 integrity metadata for `@fastify/rate-limit@10.3.0`
- Revalidated the lockfile dependency tree so `npm ci` can install the exact dependency set again

## Runtime behavior

- No SALTA runtime behavior changed
- No API behavior changed
- No database schema changed compared with v0.5.0
- The v0.5 clean-install architecture remains unchanged

## Important compatibility notice

SALTA v0.5.1 requires a fresh PostgreSQL volume when upgrading from v0.4.x. Existing v0.4.x databases and v1-encrypted credentials are intentionally not migrated.

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
0.5.1
0.5
latest
```

## Git tag

```text
v0.5.1
```
