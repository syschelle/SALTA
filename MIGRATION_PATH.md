# SALTA migration paths

## Current v0.8.87 update

v0.8.87 changes only the isolated frontend energy-formatting regression test so it provides the `appI18n.formatNumber()` dependency introduced in v0.8.86. There is no runtime, database, persistence, environment-variable or deployment migration.

v0.8.86 adds browser-localized German/English UI assets and a per-browser `salta_language` cookie. No database table, persistence schema, environment variable or container topology changes are introduced. Existing user-defined device, room, person, automation and HomeKit names remain untouched. Existing Appearance palettes remain compatible and independent of language selection.

v0.8.85 fixes the client-side Appearance profile preview/application path. No persistence format, database schema or environment variable changes are introduced. Existing saved Appearance palettes remain compatible.

v0.8.84 changes only frontend regression tests and release metadata after the configurable Appearance integration. No runtime, persistence, schema or environment-variable migration is required.

v0.8.83 adds persisted Appearance profiles and per-color customization using the existing `notification_state` table. No new table, `ALTER TABLE`, manual SQL migration or environment variable is required. Existing installations without Appearance settings automatically use the Standard profile.

v0.8.82 is a frontend-only overview polish release. It removes the descriptive Favorites subtitle and replaces the v0.8.81 room-group gradients with the requested solid `#eef2ff` background. No database schema, persistence format or environment variable changes are introduced.

v0.8.81 introduced the clearer room-group boundaries and removed the helper hint below **Geräte nach Räumen**.

v0.8.80 fixes the v0.8.79 Favorites lifecycle/CI regressions. It does not add or alter database schema. `ShellyAdapter.add()` now returns the canonical Registry device after persistence, and Registry test fixtures explicitly include the default `favorite: false` field. No manual migration is required.

v0.8.79 adds the additive `device_favorites` table for overview Favorites. No existing device table is altered and no manual SQL command is required. SALTA creates the table during normal schema initialization. Existing devices default to not being favorites until selected in the device configuration dialog. Configuration/disaster-recovery backups include the table, while older format-v1 backups without it remain compatible.

v0.8.78 adds OpenCCU XML-RPC event reception for classic HomeMatic `KEY` channels. No database migration is required. SALTA listens on TCP `18099` on its local OpenCCU-facing address and registers that callback with OpenCCU only when KEY channels are present. The production `network_mode: host` topology remains unchanged. Ensure the OpenCCU host can connect back to the SALTA host on TCP `18099`.

v0.8.77 adds the additive `presence_target_profiles` table for human-readable person names associated with existing FRITZ!Box presence targets. No existing table is altered and no manual SQL command is required. SALTA creates the new table during normal schema initialization. Existing targets without a profile automatically fall back to their current target/device name until edited. Configuration/disaster-recovery backups include the new table, while older format-v1 backups without it remain compatible.

No manual database migration or SQL repair is required. Do not delete the PostgreSQL volume. Existing `salta_postgres_data` and `salta_runtime_data` volumes are reused.

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
