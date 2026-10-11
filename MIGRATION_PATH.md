# SALTA migration paths

## Current v0.8.110 update

v0.8.110 fixes the ordered automation editor introduced in v0.8.108/v0.8.109. Existing rules now expose the complete stored **Then** sequence as one canonical ordered list. Step 1 is no longer treated as a special fixed primary editor row; every action/Wait step can be moved up/down and removed subject only to the rule retaining at least one real action.

The existing `automation_sequence_steps` table remains the canonical persistence layer. No new table, `ALTER TABLE`, data rewrite or manual SQL migration is required. The REST API adds an optional canonical `sequence` field while retaining the legacy primary/additional action fields for compatibility.

Existing v0.8.109 rules require no conversion. When they are opened, SALTA reads the exact positions already stored in `automation_sequence_steps`; when saved through v0.8.110, the same table is rewritten in the chosen order. Sequences beginning with a Wait step are now preserved exactly across save/reload.

Backup/restore remains compatible because `automation_sequence_steps` was already part of the disaster-recovery payload from v0.8.108 onward.

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
