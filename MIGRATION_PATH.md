# SALTA migration paths

## Current v0.8.138 update

v0.8.138 updates vulnerable runtime, validation and test dependencies to patched releases. It includes the FRITZ!OS diagnostics introduced in v0.8.137 and keeps PBKDF2-only FRITZ!Box Smart Home authentication unchanged. No schema migration, credential rewrite or device re-import is required.

v0.8.120 separates OpenCCU thermostat execution from automation policy. Existing automation records are not migrated or rewritten: every stored sequence step keeps its configured device ID, action, order and individual value.

OpenCCU thermostat commands are routed by technical source/type/capability to the dedicated thermostat controller. The controller reads only the selected device's live OpenCCU channel, plans the requested capability from the device metadata and live state, writes the required native datapoint(s), and verifies the same channel by live readback. Target-temperature execution no longer reads the global SALTA Summer/Winter setting.

For a classic `BidCos-RF` thermostat currently represented as OFF at its minimum target, a higher requested target uses one native `MANU_MODE=<requested temperature>` write. Classic thermostats already in Manual or Auto continue to use their discovered target-temperature datapoint, normally `SET_TEMPERATURE`. HmIP continues to use its own discovered datapoints; classic BidCos semantics are not transferred to HmIP.

The OpenCCU Duty Cycle overview field is read-only. It uses `Interface.getDutyCycle`, caches the result for the dashboard and does not modify OpenCCU configuration or radio behavior.

No database schema change, stored-automation rewrite, HomeKit reset, new dependency, mandatory environment variable or deployment-topology change is required.

The existing PostgreSQL, SALTA runtime and HomeKit data volumes remain compatible. Preserve them during the update and do not use `docker compose down -v`.

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
