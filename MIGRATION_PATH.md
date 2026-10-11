# SALTA migration paths

## Current v0.8.102 update

v0.8.102 fixes the global heating-mode thermostat policy. Summer remains `off`, while Winter is now fixed to `manual` for all compatible thermostats. The old configurable automatic Winter thermostat mode is no longer used by the heating-mode UI or runtime.

SALTA also replaces the former 12-hour Summer-only guard with an hourly global guard. Once per hour, SALTA checks compatible thermostats and repairs mode drift to `off` in Summer or `manual` in Winter. An existing `winter_mode='auto'` value is normalized to `manual` during normal database initialization with an idempotent `UPDATE`; the table schema is unchanged and no manual SQL migration is required.

The v0.8.101 additive `presence_target_network` table and fixed-IP/MAC presence recovery remain unchanged. Existing PostgreSQL and SALTA runtime volumes must be preserved during the update. Do not use `docker compose down -v`.

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
