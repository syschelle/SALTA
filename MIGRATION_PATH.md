# SALTA migration paths

## Current v0.8.107 update

v0.8.107 keeps the existing HomeKit heating-mode switch but shortens its HomeKit name to **Winter**. On still means Winter mode and Off still means Summer mode. The switch continues to call the canonical SALTA climate manager and mirrors changes made from SALTA, REST or automations.

The existing SALTA vacation mode is now also exposed to HomeKit as the built-in switch **Urlaub**. On calls `VacationModeManager.setEnabled(true)` and Off calls `VacationModeManager.setEnabled(false)`. Changes made from the SALTA web UI or REST API update the same `system:vacation-mode` state and are reflected back into HomeKit.

Database initialization upgrades the existing `system:climate-mode` and `system:vacation-mode` records idempotently. Both remain hidden from normal SALTA device lists but are enabled for HomeKit publication. No new table, `ALTER TABLE`, manual SQL migration or new environment variable is required. Existing HomeKit pairing data is preserved; a HomeKit reset or re-pair is not required.

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
