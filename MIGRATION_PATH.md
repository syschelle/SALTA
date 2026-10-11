# SALTA migration paths

## Current v0.8.109 update

v0.8.109 is an automation-editor UX release. The automation overview now contains the rule list and a **New automation** button only; creating or editing a rule opens the dedicated internal `#automation-editor` SPA page. The editor uses the full content width and separates Basics, execution days, **When**, **Only if** and **Then** into distinct sections.

The underlying automation contract is unchanged from v0.8.108. Ordered action/Wait sequences remain stored in `automation_sequence_steps`, existing automations continue to load without conversion, and the same REST payload format is used. No new table, `ALTER TABLE`, data rewrite or manual SQL is required for v0.8.109.

Existing v0.8.108 sequence semantics are carried forward unchanged, including repeated targets, Wait steps from 1 to 86400 seconds, asynchronous waits, backup/restore support and compatibility projections to the legacy automation action tables. A downgrade below v0.8.108 is still not recommended after using those sequence features.

The update adds no npm dependency, mandatory environment variable or deployment-topology change. Preserve the existing PostgreSQL and SALTA runtime volumes. Do not use `docker compose down -v`.

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
