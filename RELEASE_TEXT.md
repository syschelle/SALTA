# SALTA v0.8.41

SALTA v0.8.41 replaces the unreleased v0.8.40 configuration-only backup with a password-encrypted Disaster Recovery workflow designed to rebuild a SALTA host with minimal manual reconfiguration. The full backup contains the persistent SALTA configuration, protected application identity settings and HomeKit/HAP pairing state in one encrypted file.

## Full Disaster Recovery backup

- Added **Settings → Sicherung** with one password-encrypted full backup file: `SALTA-full-backup-<timestamp>.salta-backup.json`.
- The recovery payload includes:
  - rooms and room order
  - persisted devices and device presentation settings
  - per-device HomeKit publication, names and SALTA-room target metadata
  - Shelly, Phoscon/deCONZ, OpenCCU and FRITZ!Box Presence configuration
  - presence targets
  - automations, additional triggers and automation room assignments
  - Summer/Winter heating-mode configuration
  - Pushover battery-warning configuration and the weekly notification cooldown state
  - encrypted adapter/integration credentials
  - the SALTA administrator identity and password
  - the original `SALTA_ENCRYPTION_KEY`
  - HomeKit bridge identity, PIN and HAP pairing storage
  - restorable SALTA application security/rate-limit settings
- System logs, command history and physical-device live sensor state remain outside the portable recovery payload.
- Virtual-device state remains part of the persistent configuration so SALTA-native switches return consistently after restore.

## Password encryption

- The complete recovery payload is encrypted with **AES-256-GCM**.
- The encryption key is derived from the administrator-supplied backup password with **scrypt**, a random salt and a random IV.
- The authenticated envelope protects the backup format/version, SALTA version, creation time and non-secret object-count summary against modification.
- The backup password must contain at least 12 characters and is never stored by SALTA.
- Wrong passwords and modified ciphertext are rejected before persistent SALTA configuration is changed.
- Runtime secrets and HomeKit pairing contents do not appear in plaintext in the exported JSON envelope.

## Replacement-host recovery

- A replacement host only needs a minimal working SALTA Docker bootstrap so PostgreSQL and the SALTA web interface can start.
- After login, the administrator selects the full backup, enters its backup password and confirms the restore.
- SALTA restores PostgreSQL configuration plus the recovered runtime/HomeKit state and then performs a controlled restart.
- After restart, recovered application settings intentionally override the corresponding temporary bootstrap `.env` values through the persistent `/var/lib/salta/runtime/settings.json` file.
- This restores the original administrator credentials, `SALTA_ENCRYPTION_KEY`, HomeKit identity/PIN and other restorable application settings without manually re-entering them.
- Physical integrations reconnect from their restored configuration and repopulate current device state after restart.

## Host-specific settings intentionally remain local

- The portable backup does not replace the replacement host's PostgreSQL bootstrap credentials.
- `POSTGRES_PASSWORD`, `SALTA_HEALTH_TOKEN`, published `WEB_PORT`/`HOMEKIT_PORT` mappings and host networking remain deployment settings for the new host.
- The old web port, HomeKit port and timezone are included only as non-secret recovery hints; SALTA reports differences after import so the administrator can review the replacement-host configuration.
- This separation avoids copying host-specific Docker credentials or network bindings into a different machine while still restoring SALTA itself.

## Persistent HomeKit pairing state

- Added persistent runtime storage through the named Docker volume `salta_runtime_data` mounted at `/var/lib/salta`.
- HAP-NodeJS now uses the explicit storage path `/var/lib/salta/homekit` instead of relying on container-local default persistence.
- HomeKit/HAP pairing files are included inside the encrypted Disaster Recovery payload and restored before SALTA restarts.
- Added `migrate-homekit-storage.sh` for existing installations that already paired HomeKit before v0.8.41.
- The migration copies legacy pairing data from the still-existing pre-v0.8.41 container into `salta_runtime_data` before the first v0.8.41 recreate.
- The migration does not overwrite an already populated persistent HomeKit directory.
- `update.sh` runs the migration automatically before recreating the SALTA container.
- This preserves bridge identity/pairing data; Apple Home remains authoritative for Apple Home room placement.

## Transactional restore safeguards

- The encrypted backup envelope, payload version and SALTA database schema are validated before import.
- The embedded persistent configuration snapshot is validated with the original restored `SALTA_ENCRYPTION_KEY`, allowing encrypted database credentials to remain usable on a new host.
- HomeKit and runtime files are staged before replacement.
- Database configuration replacement and runtime/HomeKit installation are coordinated so failures before PostgreSQL commit roll back both the database transaction and filesystem changes.
- Temporary previous HomeKit state is removed only after the database restore commits successfully.
- Import requests use a dedicated low mutation rate limit and a 10 MiB request-body limit.
- Export/import system-log events contain only safe object counts and status metadata, never passwords, encryption keys, adapter credentials or backup contents.

## Recovery UI

- Added separate backup-password and confirmation fields for export.
- Added local backup-envelope inspection before import, including source SALTA version, creation time and counts for rooms, devices, automations and HomeKit files.
- Import requires an explicit confirmation because the current persistent SALTA configuration, runtime identity and HomeKit pairing state are replaced.
- The UI reports host-setting differences after recovery and reloads after the controlled SALTA restart.
- The full recovery UI remains responsive and follows the existing SALTA Settings layout.

## Regression coverage

- Added Disaster Recovery tests proving that administrator credentials, `SALTA_ENCRYPTION_KEY` and HomeKit pairing contents are not exposed in the outer JSON backup.
- Added restore coverage for recovered runtime identity and HomeKit storage.
- Added wrong-password/tamper rejection before configuration import.
- Added runtime-settings persistence tests.
- Added server API and rate-limit coverage for full recovery export/import.
- Added frontend coverage for the password-protected recovery UI and API wiring.
- Added deployment/release validation for the persistent HomeKit volume, explicit HAP storage path and legacy HomeKit migration helper.

## Upgrade note for existing HomeKit users

Before the first v0.8.41 container recreate, pull the v0.8.41 source and run:

```bash
./migrate-homekit-storage.sh
```

Then update normally:

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

When `update.sh` is used, the migration step is performed automatically. If HomeKit has never been paired, the migration is a safe no-op.

## Compatibility

- v0.8.40 was not released; v0.8.41 supersedes its configuration-backup work.
- No database schema migration is required.
- No fresh PostgreSQL volume is required.
- No new mandatory `.env` variable is required.
- Existing database data remains compatible.
- The new `salta_runtime_data` volume is created automatically by Docker Compose.
- Existing HomeKit pairing can be preserved with the one-time pre-recreate migration described above.
- Existing Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, FRITZ!Box Presence, climate-mode, battery-warning, Pushover, Daylight, virtual-device and automation functionality remains compatible.

## Security and dependencies

- Full backups now contain high-value recovery material but only inside the password-encrypted AES-256-GCM payload; store the backup file and password separately and securely.
- Runtime recovery files are written with restrictive permissions inside the persistent SALTA runtime volume.
- No production or development npm dependency was added or intentionally changed in v0.8.41.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains patched `fast-uri` `3.1.5` and `4.1.2`.
- Retains PostCSS `8.5.23`.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.41
0.8
latest
```

## Git tag

```text
v0.8.41
```
