# SALTA migration paths

## Current v0.8.99 update

v0.8.99 adds the Shelly automation action **On for seconds**. The duration is stored in the additive `automation_timed_actions` table. SALTA creates this table automatically during normal database initialization; no manual SQL migration is required.

Existing automation, PostgreSQL and runtime data remains in place. Do not remove Docker volumes during the update. Older configuration backups remain compatible because the new timed-action backup section is optional during import.

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
