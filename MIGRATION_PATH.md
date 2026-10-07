# SALTA migration paths

## Current v0.8.100 update

v0.8.100 adds the automation trigger option **Closed for 10 seconds** for window and door contact sensors. The delayed trigger is stored through the existing automation trigger state key and therefore requires no new table, no `ALTER TABLE` statement and no manual SQL migration.

Existing automations keep their current immediate trigger behavior unless the new 10-second option is explicitly selected. Existing PostgreSQL and runtime data remains in place. Do not remove Docker volumes during the update.

The additive `automation_timed_actions` table introduced in v0.8.99 for Shelly **On for seconds** actions remains unchanged and continues to be created automatically by normal database initialization when required.

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
