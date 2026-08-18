# SALTA v0.8.92

SALTA v0.8.92 is a test-maintenance release for the v0.8.91 Phoscon button-event reliability fix. GitHub CI showed that the runtime, TypeScript build, release validation, preflight checks and the new Phoscon race tests all passed, while one older source-inspection assertion in `phoscon-websocket.test.ts` still expected the pre-v0.8.91 `shouldEmit` implementation detail. The stale assertion is now aligned with the new exact-once `claimedSignature` gate. Runtime behavior is unchanged from v0.8.91.

## v0.8.92 Phoscon websocket regression-test alignment

- Fixed the single failing `phoscon-websocket.test.ts` assertion reported by the v0.8.91 `npm run check` CI run.
- Replaced the obsolete expectation for `if (!shouldEmit || eventValue === undefined) return` with the active v0.8.91 exact-once gate `if (!claimedSignature || eventValue === undefined) return`.
- Removed duplicate copies of the new v0.8.91 deduplication source assertions while keeping each contract covered once.
- No Phoscon adapter runtime code was changed in v0.8.92.
- The full v0.8.91 button-event recovery and cross-transport deduplication behavior is carried forward unchanged.
- No database schema migration, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.91 Phoscon button-event reliability

- Fixed the confirmed race between the normal Phoscon reconcile and the 2-second button fallback poll.
- A newly discovered `buttonevent` revision found by the normal reconcile now emits the same `deviceEvent` used by realtime/fallback handling instead of silently consuming the revision.
- Added cross-transport event deduplication so the same deCONZ button event is emitted only once when WebSocket, fallback polling and reconcile observe it in different orders.
- Event identity uses the Phoscon sensor resource, button-event value and deCONZ `lastupdated` revision.
- Added pending-event tracking so concurrent reconcile and fallback processing cannot both emit the same event while Registry persistence is still in flight.
- Added a bounded recent-event cache to suppress delayed duplicates without allowing unbounded memory growth.
- If Registry persistence fails while an event is pending, the claim is released so a later transport can recover the event instead of losing it permanently.
- The Phoscon device metadata records `buttonEventTransport: "reconcile"` when normal reconciliation recovers a missed event; existing `poll` and `websocket` reporting remains supported.
- Normal reconcile preserves the previous button-event transport when no new button revision was detected.
- Added runtime regression tests for missed-event recovery and duplicate suppression across reconcile, fallback polling and realtime delivery.
- Strengthened release validation so the cross-transport deduplication and reconcile recovery path cannot be removed accidentally.

## v0.8.90 localization completeness audit

- Completed the second German/English localization audit for dynamic runtime text.
- Expanded translation coverage for DEBUG, credentials, realtime adapter state, HomeKit, Heating mode, battery warnings, device information, OpenCCU diagnostics, Presence and Automation messages.
- Fixed the remaining locale-unaware OpenCCU timestamps so they follow the selected SALTA language.
- Added phrase/pattern parity and dynamic localization release gates.

## Compatibility

- v0.8.92 changes test/release metadata only; runtime behavior is unchanged from v0.8.91.
- Existing Phoscon/deCONZ configuration and API credentials remain compatible.
- Existing button automation trigger values such as `event:buttonEvent:1002` remain unchanged.
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
