# SALTA migration paths

## Current v0.8.141 update

v0.8.141 changes only Pushover warning policy for OpenCCU/HomeMatic devices. It adds a dedicated notification-state key and does not change the database schema, stored device IDs, automations, credentials or OpenCCU pairing.

OpenCCU/HomeMatic devices are aggregated by physical device address. A device enters the dedicated warning when it reports a low-battery state, a battery percentage at or below the configured Pushover threshold, or `reachable=false`. The OpenCCU warning may repeat after 24 hours while any issue persists. Battery warnings from other sources retain their existing seven-day repeat interval.

An unreachable device is reported as unreachable without assuming a battery failure unless SALTA also has a battery warning for that device.

No database schema change, stored-automation rewrite, HomeKit reset, HomeMatic re-pair, new dependency, mandatory environment variable or deployment-topology change is required.

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
