# SALTA migration paths

## Current v0.8.108 update

v0.8.108 extends the existing v0.8.x automation engine with ordered action/wait sequences. The first **Then** step remains a normal action; later steps can be additional actions or explicit **Wait** steps from 1 to 86400 seconds. The same target device may appear more than once, which allows sequences such as `Light On → Wait 30 s → Cover Close → Wait 5 s → Light Off`.

Persistence is additive. SALTA creates the new `automation_sequence_steps` table during normal database initialization. Existing automation target rows from `automation_targets`, `automation_timed_actions` and `automation_system_actions` are copied idempotently into the new canonical sequence representation with `ON CONFLICT ... DO NOTHING`. Existing legacy tables are not altered or dropped and continue to receive a best-effort compatibility projection when a sequence is saved.

No manual SQL is required and no `ALTER TABLE` statement is introduced. Existing automations continue to work after the update. Configuration/disaster-recovery backups now include `automation_sequence_steps`; older format-v1 backup files that do not contain that table remain accepted and are upgraded into the sequence representation during restore.

A downgrade to a release before v0.8.108 is not recommended after creating sequences that use Wait steps or repeat the same target. The old runtime cannot interpret those new semantics even though the additive sequence rows remain in PostgreSQL. Upgrade forward again to v0.8.108 or newer to regain the complete sequence behavior.

The update does not add an npm dependency, mandatory environment variable or deployment-topology change. Preserve the existing PostgreSQL and SALTA runtime volumes. Do not use `docker compose down -v`.

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
