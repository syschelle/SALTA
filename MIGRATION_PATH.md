# SALTA migration paths

## Current v0.8.106 update

v0.8.106 exposes SALTA's existing global Summer/Winter heating mode to HomeKit as the built-in switch **Wintermodus**. The switch is On in Winter mode and Off in Summer mode. Toggling the switch in Apple Home calls the same central SALTA climate-mode manager used by the web UI and automations, so there is no separate HomeKit-only state.

Database initialization updates the existing `system:climate-mode` system record idempotently to a HomeKit-capable switch and enables it with the HomeKit name `Wintermodus`. The system device remains hidden from normal SALTA device lists. Existing HomeKit bridge pairing data is preserved; a HomeKit reset or re-pair is not required.

There is no new database table, no `ALTER TABLE`, no manual SQL step and no data migration command. Existing PostgreSQL and SALTA runtime volumes must be preserved during the update. Do not use `docker compose down -v`.

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
