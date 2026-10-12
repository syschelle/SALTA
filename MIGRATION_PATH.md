# SALTA migration paths

## Current v0.8.113 update

v0.8.112 is a command-routing fix for classic HomeMatic thermostat target-temperature actions. No stored automation data changes are required.

When a classic BidCos/HomeMatic thermostat reports `manual` or `off`, SALTA now applies a requested target temperature through the native writable `MANU_MODE` temperature datapoint. This keeps/restores manual mode atomically with the requested setpoint. AUTO mode continues to use the normal target-temperature datapoint so a setpoint-only action does not unexpectedly force Manual. HmIP devices remain isolated from this classic HomeMatic path.

The existing database schema, `automation_sequence_steps` data, HomeKit pairing state and runtime volumes are unchanged. No new table, `ALTER TABLE`, data rewrite or manual SQL migration is required.

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
