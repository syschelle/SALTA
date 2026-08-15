# SALTA migration paths

## Current v0.8.63 update

No manual database migration is required. Existing `salta_postgres_data` and `salta_runtime_data` volumes are reused.

v0.8.63 only simplifies visible settings-navigation labels and carries forward the Philips Hue Bridge adapter plus the v0.8.62 frontend regression-test maintenance. Hue connection metadata and the encrypted bridge application key reuse the existing `adapter_settings` table, so no new table and no destructive `ALTER TABLE` statement are introduced. Existing Shelly, Phoscon, OpenCCU, FRITZ!Box, virtual-device and automation data remain unchanged.

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
