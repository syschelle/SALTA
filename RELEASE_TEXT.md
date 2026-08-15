# SALTA v0.8.54

SALTA v0.8.54 adds multi-target actions to the automation engine and includes the HomeKit settings and central device-publication improvements prepared after v0.8.52. One automation can now control several target devices in its **Dann** step while preserving existing single-target automations unchanged.

## Multiple target devices in automations

- Added **Weiteres Zielgerät hinzufügen** to step **3 · Dann** in the automation editor.
- One automation can control up to eight target devices in total.
- Each target device has its own `An`, `Aus` or `Toggle` action according to the capabilities exposed by that device.
- Additional targets are displayed as compact **UND** entries because every configured target action is executed when the automation fires.
- Existing automations remain fully compatible: their existing `actionDeviceId` / `action` pair stays the primary target action.
- The automation overview now shows every configured target action instead of only the first target device.

## Execution safety

- Target devices are validated independently before an automation is saved.
- A target device cannot also be one of the automation's trigger devices.
- The same target device cannot be configured twice in one automation.
- Cycle detection now includes every additional target device, preventing loops that pass through secondary actions.
- If one target is temporarily unreachable or one command fails, SALTA continues with the remaining target actions.
- Individual failures and skipped targets are written to the system log with the affected device and action.
- An automation is marked as triggered when at least one configured target action succeeds.

## Additive persistence and recovery

- Added the canonical `automation_actions` table for up to seven additional target actions per automation.
- The existing primary action remains in the `automations` table, preserving existing installations and rules.
- No destructive `ALTER TABLE` migration is used; the table is created additively during normal SALTA database initialization.
- Configuration/disaster-recovery backups now export and restore `automation_actions`.
- Existing format-v1 configuration backups that do not contain `automation_actions` remain accepted and restore with an empty additional-action list.

## HomeKit settings improvements included

- Includes the compact and responsive **Settings → HomeKit** redesign prepared after v0.8.52.
- Fixes the HomeKit settings width/overflow issue.
- Hides the QR/pairing block completely after successful pairing.
- Adds a central **Geräte in HomeKit** list grouped by SALTA room.
- Supported OpenCCU thermostats and contact sensors can be enabled for HomeKit directly from the HomeKit settings page.
- Contact sensors show their live open/closed state; thermostats show their available temperature/mode information.
- Hidden Zigbee devices remain excluded from HomeKit.

## Compatibility

- Builds on the released SALTA v0.8.52 baseline and supersedes the unreleased v0.8.53 candidate.
- Existing single-target automations require no changes.
- No manual database migration is required.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- SALTA continues to use `network_mode: host` for HomeKit HAP/mDNS.
- PostgreSQL remains on Docker's normal bridge network and is published only on host loopback.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- `/opt/SALTA/migrate-homekit-storage.sh` is still required only for HomeKit pairing state created before v0.8.41.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `down -v` during the update.
