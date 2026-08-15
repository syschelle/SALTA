# SALTA migration paths

## Current v0.8.59 update

No manual database migration is required. Existing `salta_postgres_data` and `salta_runtime_data` volumes are reused.

v0.8.59 adds momentary-button behavior to the existing virtual-device adapter and stores the selected virtual kind in the already existing `adapterData` JSON metadata. No new table and no destructive `ALTER TABLE` statement are introduced.

Existing virtual switches remain persistent switches. They can be converted in the SALTA device settings to a momentary button while keeping the same device ID, room assignment, HomeKit publication metadata and automation references.

The additive automation persistence tables from the preceding releases remain unchanged.

No HomeKit storage migration is required when the installation already uses the persistent runtime layout introduced in v0.8.41 or newer.

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
