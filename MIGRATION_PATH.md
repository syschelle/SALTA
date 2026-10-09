# SALTA migration paths

## Current v0.8.101 update

v0.8.101 adds fixed-IP identity support to FRITZ!Box Wi-Fi presence. Presence targets can now store a fixed IP address alongside the MAC address. When the stored MAC is no longer active, SALTA resolves the configured IP through the FRITZ!Box Hosts service and can automatically replace the stored MAC if the same fixed IP is now associated with a different private Wi-Fi MAC.

Persistence is additive: v0.8.101 creates `presence_target_network` with `CREATE TABLE IF NOT EXISTS`. It does not modify `presence_targets`, does not use `ALTER TABLE`, and requires no manual SQL migration. Existing presence targets continue to work by MAC address until an administrator edits them and adds a fixed IP. Configuration/disaster-recovery backups include the new table while older format-v1 backups without it remain restorable.

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
