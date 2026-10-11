# SALTA migration paths

## Current v0.8.105 update

v0.8.105 reduces unnecessary OpenCCU/HomeMatic thermostat commands from SALTA's global heating-mode routines. The hourly Winter guard now writes `manual` only when OpenCCU explicitly reports a thermostat as `AUTO`. Explicit Summer/Winter application skips thermostats already in the requested state, and OpenCCU `VirtualDevices` heating groups are excluded from global mode writes to avoid duplicate commands to a group and its physical members.

The hourly check remains enabled. Summer continues to enforce `OFF` for known non-OFF states. Winter continues to switch physical thermostats to `manual` when the user or an automation explicitly applies Winter mode, while the hourly safety check only repairs accidental Auto mode.

There is no database schema change, no `ALTER TABLE`, no data migration and no manual SQL step. Existing PostgreSQL and SALTA runtime volumes must be preserved during the update. Do not use `docker compose down -v`.

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
