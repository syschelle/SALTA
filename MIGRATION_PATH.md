# SALTA migration paths

## Current v0.8.103 update

v0.8.103 is a dependency-security release. It refreshes the npm dependency graph to patched Fastify, fast-uri, Vitest/@vitest/mocker and source-map-js releases and removes the vulnerable Tinypool 1.x path that was pulled in by the previous Vitest 3.x toolchain.

There is no database schema change, no `ALTER TABLE`, no data migration and no manual SQL step. The v0.8.102 thermostat policy, v0.8.101 presence persistence and all existing runtime data formats are unchanged.

Existing PostgreSQL and SALTA runtime volumes must be preserved during the update. Do not use `docker compose down -v`.

## Legacy HomeKit migration (pre-v0.8.41 pairing only)

Host helper:

```text
/opt/SALTA/migrate-homekit-storage.sh
```

Run from the production checkout before the old SALTA container is recreated:

```bash
cd /opt/SALTA
./migrate-homekit-storage.sh
```

Migration path:

```text
old SALTA container: /app/persist
        ↓
salta_runtime_data volume
        ↓
new SALTA container: /var/lib/salta/homekit
```

Runtime settings are persisted separately inside the same volume at:

```text
/var/lib/salta/runtime/settings.json
```

The script does not overwrite an already populated `/var/lib/salta/homekit` target.
