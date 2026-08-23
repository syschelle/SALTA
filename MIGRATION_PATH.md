# SALTA migration paths

## Current v0.8.98 update

v0.8.98 updates only two isolated frontend test DOM mocks after the v0.8.96 weekday UI added `document.querySelectorAll()`. Production runtime behavior, weekday schedules, database schema, persistence format, environment variables and deployment topology are unchanged from v0.8.97.

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
