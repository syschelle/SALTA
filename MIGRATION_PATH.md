# SALTA migration paths

v0.8.69 fixes the startup SQL used to create/update the hidden `system:climate-mode` automation target. The canonical schema is unchanged: `devices.capabilities` remains `jsonb`, and schema initialization now supplies a JSONB array instead of a PostgreSQL `text[]`.

## Current v0.8.80 update

v0.8.80 fixes the v0.8.79 Favorites lifecycle/CI regressions. It does not add or alter database schema. `ShellyAdapter.add()` now returns the canonical Registry device after persistence, and Registry test fixtures explicitly include the default `favorite: false` field. No manual migration is required.

v0.8.79 adds the additive `device_favorites` table for overview Favorites. No existing device table is altered and no manual SQL command is required. SALTA creates the table during normal schema initialization. Existing devices default to not being favorites until selected in the device configuration dialog. Configuration/disaster-recovery backups include the table, while older format-v1 backups without it remain compatible.

v0.8.78 adds OpenCCU XML-RPC event reception for classic HomeMatic `KEY` channels. No database migration is required. SALTA listens on TCP `18099` on its local OpenCCU-facing address and registers that callback with OpenCCU only when KEY channels are present. The production `network_mode: host` topology remains unchanged. Ensure the OpenCCU host can connect back to the SALTA host on TCP `18099`.

v0.8.77 adds the additive `presence_target_profiles` table for human-readable person names associated with existing FRITZ!Box presence targets. No existing table is altered and no manual SQL command is required. SALTA creates the new table during normal schema initialization. Existing targets without a profile automatically fall back to their current target/device name until edited. Configuration/disaster-recovery backups include the new table, while older format-v1 backups without it remain compatible.

v0.8.76 changes only the overview HTML/CSS hierarchy and its frontend regression tests. There is no backend, runtime, persistence or schema migration.

v0.8.75 changed only frontend regression tests. There is no runtime, persistence or schema change.

v0.8.74 adds Vacation mode without a schema migration. The persisted Vacation mode flag reuses the existing `notification_state` table, which is already included in SALTA configuration and disaster-recovery backups. The hidden `system:vacation-mode` automation-condition device is created through the normal typed device persistence path during startup.

The additive `automation_conditions` table introduced in v0.8.71 remains unchanged, as do the v0.8.70 Heating mode condition and the v0.8.69 JSONB startup fix.


No manual database migration or SQL repair is required. Do not delete the PostgreSQL volume. Starting v0.8.69 is sufficient; the corrected idempotent schema initialization creates or updates the hidden Heating mode target automatically. Existing `salta_postgres_data` and `salta_runtime_data` volumes are reused.

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
