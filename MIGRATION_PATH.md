# SALTA migration paths

## Current v0.8.141 update

v0.8.141 adds diagnostics and read-only health enrichment; it does not change stored device IDs, automation records or credentials. Phoscon/deCONZ status now distinguishes REST reachability from Zigbee radio health and exposes the existing firmware/radio/channel fields as an explicit gateway health state.

For classic HomeMatic `BidCos-RF` devices, SALTA additionally reads the physical maintenance channel `:0` during normal OpenCCU reconciliation and merges its service values, including `LOWBAT`, into the visible device state. Maintenance channels remain hidden and are not imported as separate devices. HmIP is intentionally not routed through this classic BidCos-specific path.

The existing Pushover battery monitor is reused. No new notification credential, database table or schema migration is required.

No database schema change, stored-automation rewrite, HomeKit reset, Zigbee/HomeMatic re-pair, new dependency, mandatory environment variable or deployment-topology change is required.

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
