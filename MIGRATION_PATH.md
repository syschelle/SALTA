# SALTA migration paths

v0.8.67 is a regression-fix release for the Heating mode automation integration. It does not add or alter database schema. The additive `automation_system_actions` table and hidden `system:climate-mode` target introduced in v0.8.66 remain unchanged.

## Current v0.8.67 update

No manual database migration is required. Existing `salta_postgres_data` and `salta_runtime_data` volumes are reused.

v0.8.65 adds daily local-time automation triggers. No manual migration command is required: SALTA creates the additive `automation_time_triggers` table during normal schema initialization and leaves the existing `automations` table and its device-trigger records unchanged. Existing device-trigger automations continue to load exactly as before, and old configuration/disaster-recovery backups that do not contain the new table remain importable. The scheduler uses the configured `TZ` value (default `Europe/Berlin`).

The README story and reliability-first project description introduced in v0.8.64 remain unchanged, as do the settings-navigation cleanup from v0.8.63 and the Philips Hue Bridge integration. Existing Shelly, Phoscon, Hue, OpenCCU, FRITZ!Box and virtual-device data remain unchanged.

Hue devices are created during the first successful Hue reconciliation. Local SALTA names, room assignments, presentation metadata and per-device HomeKit choices are preserved on later reconciliations. Disconnecting Hue removes only the synchronized SALTA Hue records and does not alter the Philips Hue Bridge itself.

The v0.8.59 virtual-device `adapterData.virtualType` metadata remains compatible and requires no migration. The additive automation persistence tables from the preceding releases also remain unchanged.

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
