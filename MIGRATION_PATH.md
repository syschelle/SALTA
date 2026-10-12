# SALTA migration paths

## Current v0.8.120 update

v0.8.118 narrows classic BidCos/HomeMatic target-temperature recovery while a thermostat is in SALTA's synthetic OFF state. When a classic `BidCos-RF` thermostat is reported as `off` at its minimum target temperature and a higher target is requested, SALTA uses the native `MANU_MODE=<temperature>` command so the device leaves the physical OFF representation and enters manual operation at the requested setpoint.

Classic thermostats already in Manual or Auto continue to use their discovered target-temperature datapoint, normally `SET_TEMPERATURE`. Homematic IP behavior is unchanged and continues to use its own discovered target-temperature datapoint, normally `SET_POINT_TEMPERATURE`.

The sanitized diagnostic export is upgraded to format version 2. Date values are preserved as ISO timestamps, and presence devices no longer expose MAC, IP or host identifiers through the general device-registry section.

No stored automation data changes are required. Existing Nachtabsenkung/Taganhebung actions keep their configuration and use the corrected runtime command only when the classic BidCos thermostat is currently OFF.

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
