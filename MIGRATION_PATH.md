# SALTA migration paths

## Current v0.8.117 update

v0.8.114 is an OpenCCU thermostat command-routing correction. A `setTargetTemperature` action now writes only the thermostat's native target-temperature datapoint and no longer writes `MANU_MODE` or another operating-mode datapoint.

No stored automation data changes are required. Existing automations that set a target temperature keep the same configuration; only their OpenCCU runtime command is corrected.

The existing database schema, HomeKit pairing state and runtime volumes remain unchanged. No new table, `ALTER TABLE`, data rewrite or manual SQL migration is required.

No npm dependency, mandatory environment variable or deployment-topology change is introduced. Preserve the existing PostgreSQL and SALTA runtime volumes. Do not use `docker compose down -v`.

## v0.8.107 HomeKit system switches

v0.8.107 keeps the existing HomeKit heating-mode switch but shortens its HomeKit name to **Winter**. On means Winter mode and Off means Summer mode. The existing SALTA vacation mode is also exposed to HomeKit as the built-in **Urlaub** switch. Both switches call their canonical SALTA managers and mirror changes made from SALTA back into HomeKit.

Database initialization upgrades the existing `system:climate-mode` and `system:vacation-mode` records idempotently. Existing HomeKit pairing data is preserved; a HomeKit reset or re-pair is not required.

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
