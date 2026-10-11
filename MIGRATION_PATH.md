# SALTA migration paths

## Current v0.8.104 update

v0.8.104 is a focused OpenCCU/Homematic IP thermostat synchronization fix. Established HmIP thermostat families now read the active operating mode from `SET_POINT_MODE` and send operating-mode commands through `CONTROL_MODE`. Newer R4M-family devices keep their explicitly reversed direction. Existing/pre-upgrade HmIP metadata is normalized when a thermostat mode command is built, so no manual device rediscovery is required.

There is no database schema change, no `ALTER TABLE`, no data migration and no manual SQL step. The v0.8.103 dependency-security graph, v0.8.102 hourly heating-mode policy, v0.8.101 presence persistence and all existing runtime data formats remain compatible.

Existing PostgreSQL and SALTA runtime volumes must be preserved during the update. Do not use `docker compose down -v`.

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
