# SALTA v0.8.124

SALTA v0.8.124 keeps the system log useful on long-running installations by making noisy messages configurable and by aggregating identical repeats instead of letting them consume the complete 100-entry retention window.

## Changes

- Added configurable hide patterns directly on the System Log page.
- Hide patterns are case-insensitive substring matches against log source, code and message.
- Added a `Show hidden` switch for temporarily displaying filtered entries without changing the saved configuration.
- Added configurable repeat aggregation for identical log entries.
- The repeat window can be configured from 1 to 1440 minutes.
- Repeated entries keep a counter plus first-seen and last-seen timestamps.
- Continuous identical events are updated in place instead of creating a new database row on every poll.
- Existing retained duplicates are also collapsed when the system log is read, so installations benefit immediately after the update.
- Hide patterns only change the normal System Log view. Stored entries remain available for diagnostics.
- System-log settings use the existing backed-up `notification_state` persistence.

## Root Cause

The persistent system log intentionally keeps only the newest 100 entries. Repeated adapter warnings such as `OPENCCU_CHANNEL_READ_PARTIAL` could be emitted on every OpenCCU polling cycle with exactly the same details. Those duplicate records were technically useful but could quickly displace unrelated automation and adapter diagnostics from the bounded log history.

v0.8.124 separates two concerns: repeat aggregation prevents identical recurring events from consuming retention capacity, while configurable hide patterns let administrators remove known-noisy messages from the normal view without deleting their stored diagnostic information.

## Compatibility

- No database schema change or migration is required.
- Existing system-log rows remain compatible.
- Existing log retention remains capped at 100 entries and 30 days.
- Existing backups remain compatible; the new settings are stored in the already-backed-up `notification_state` table.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing automations require no editing.
- Existing PostgreSQL, SALTA runtime and HomeKit volumes remain compatible.
- OpenCCU communication, device polling and automation execution behavior are unchanged.

## Tests

- Regression coverage verifies normalization and case-insensitive hide-pattern matching.
- Regression coverage verifies repeat aggregation and separation of later repeat episodes.
- API coverage verifies reading and updating the system-log settings.
- Frontend coverage verifies the filtering controls, show-hidden switch and repeat badge.
- Diagnostic-export coverage verifies that saved hide patterns do not suppress diagnostic log data.
- Release validator passed for SALTA v0.8.124.
- JavaScript syntax checks passed.
- TypeScript production build passed.
- Test symbol preflight passed for 99 test files.
- 99 of 99 test files passed.
- 558 of 558 tests passed.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.
