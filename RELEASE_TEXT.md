# SALTA v0.6.1

SALTA v0.6.1 fixes the Phoscon test-suite build failure introduced in v0.6.0.

## Build and test fix

- Moved Phoscon URL normalization, REST response parsing and Zigbee device mapping into a pure core module
- Removed the indirect database and production configuration import from the Phoscon mapping tests
- Prevented test collection from requiring `DATABASE_URL`, `ADMIN_PASSWORD`, `SALTA_HEALTH_TOKEN` or `SALTA_ENCRYPTION_KEY`
- Kept database persistence, encrypted API-key handling, polling and device commands in the runtime Phoscon adapter
- Preserved all Phoscon and Zigbee behavior introduced in v0.6.0

## Compatibility

- No application behavior changed
- No API behavior changed
- No database schema migration is required
- No new `.env` variable is required
- No fresh installation is required

## Updating

```bash
./update.sh
```

For a new installation:

```bash
./install.sh
```

## Container tags

```text
0.6.1
0.6
latest
```

## Git tag

```text
v0.6.1
```
