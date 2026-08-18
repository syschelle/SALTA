# SALTA v0.8.93

SALTA v0.8.93 adds bounded retention for the persistent device-command history. The existing `commands` table is now automatically limited to the most recent 90 days and, independently, to the 10,000 newest records. This prevents an unusual command loop or very long-running installation from growing command history without limit while preserving ample diagnostics for normal use.

## v0.8.93 bounded command-history retention

- Added automatic cleanup for records in the existing `commands` table.
- Command records older than **90 days** are removed automatically.
- A hard upper bound retains only the **10,000 newest command records**, even if many commands are generated in a short period.
- Retention runs during normal database/schema initialization so an existing installation is cleaned automatically on startup.
- Retention also runs after each newly persisted API command, so the table remains bounded while SALTA runs continuously and does not depend on a restart for cleanup.
- Cleanup is intentionally best-effort in the command request path: a transient cleanup failure does not change an otherwise successful device command into a failed command.
- The existing `/api/commands` response remains limited to the latest 100 records; this release changes storage retention, not the API display contract.
- Added regression tests and release-validator contracts for the 90-day limit, the 10,000-row hard cap and the runtime retention hook.
- No `ALTER TABLE`, new database table, manual SQL migration, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.92 Phoscon websocket regression-test alignment

- Fixed the single stale `phoscon-websocket.test.ts` source-inspection assertion left behind by the v0.8.91 Phoscon button-event deduplication refactor.
- Runtime Phoscon behavior remained unchanged from v0.8.91.

## v0.8.91 Phoscon button-event reliability

- Fixed the confirmed race between the normal Phoscon reconcile and the 2-second button fallback poll.
- A newly discovered `buttonevent` revision found by normal reconcile now emits the same `deviceEvent` used by realtime/fallback handling instead of silently consuming the revision.
- Added cross-transport exact-once deduplication for WebSocket, fallback polling and reconcile using the Phoscon resource ID, button-event value and deCONZ `lastupdated` revision.
- Added pending-event tracking and a bounded recent-event cache so concurrent or delayed deliveries do not double-trigger an automation.
- Reconcile can recover a missed button event and records `buttonEventTransport: "reconcile"` when it does so.

## v0.8.90 localization completeness audit

- Completed the second German/English localization audit for dynamic runtime text.
- Expanded translation coverage for DEBUG, credentials, realtime adapter status, HomeKit, Heating mode, battery warnings, device information, OpenCCU diagnostics, Presence and Automation messages.
- Fixed the remaining locale-unaware OpenCCU timestamps.

## Compatibility

- v0.8.93 reuses the existing `commands` table and does not alter database schema.
- Existing command records newer than 90 days are preserved unless more than 10,000 newer records exist.
- Existing Phoscon/deCONZ configuration, credentials and button automation trigger values remain compatible.
- Existing browser language selections and Appearance settings remain compatible.
- Existing Favorites, Presence profiles, OpenCCU realtime button events, Vacation mode, Heating mode, multi-condition automations and daily time triggers remain unchanged.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- No manual database migration is required.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.

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
