# SALTA v0.8.91

SALTA v0.8.91 fixes an intermittent Phoscon/deCONZ button-event race that could cause automations to miss physical button presses. The issue occurred when the 15-second normal Phoscon reconcile observed a new `buttonevent` before the 2-second fallback button poll: the reconcile updated the stored button revision but did not emit an automation event, so the later fallback poll considered the event already consumed.

## v0.8.91 Phoscon button-event reliability

- Fixed the confirmed race between the normal Phoscon reconcile and the 2-second button fallback poll.
- A newly discovered `buttonevent` revision found by the normal reconcile now emits the same `deviceEvent` used by realtime/fallback handling instead of silently consuming the revision.
- Added cross-transport event deduplication so the same deCONZ button event is emitted only once when WebSocket, fallback polling and reconcile observe it in different orders.
- Event identity uses the Phoscon sensor resource, button-event value and deCONZ `lastupdated` revision.
- Added pending-event tracking so concurrent reconcile and fallback processing cannot both emit the same event while Registry persistence is still in flight.
- Added a bounded recent-event cache to suppress delayed duplicates without allowing unbounded memory growth.
- If Registry persistence fails while an event is pending, the claim is released so a later transport can recover the event instead of losing it permanently.
- The Phoscon device metadata now records `buttonEventTransport: "reconcile"` when the normal reconcile is the path that recovers a missed event; existing `poll` and `websocket` transport reporting remains supported.
- Normal reconcile preserves the previous button-event transport when no new button revision was detected.
- Added runtime regression tests for a button revision recovered by normal reconcile, fallback poll winning before reconcile, and reconcile/fallback observing the same event concurrently.
- Strengthened release validation so the cross-transport deduplication and reconcile recovery path cannot be removed accidentally.
- No database schema migration, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.90 localization completeness audit

- Completed the second German/English localization audit for dynamic runtime text.
- Expanded translation coverage for DEBUG, credentials, realtime adapter state, HomeKit, Heating mode, battery warnings, device information, OpenCCU diagnostics, Presence and Automation messages.
- Fixed the remaining locale-unaware OpenCCU timestamps so they follow the selected SALTA language.
- Added phrase/pattern parity and dynamic localization release gates.

## v0.8.89 sidebar selector compactness

- Refined the sidebar language selector so its label and dropdown no longer compete for horizontal space.
- The compact sidebar control uses a stacked layout with a constrained right-aligned selector.
- The full-size language selector under **Settings → Appearance** remains unchanged.

## v0.8.88 CodeQL security hardening

- Fixed the OpenCCU XML-RPC incomplete multi-character sanitization finding by rejecting unknown typed markup instead of stripping tags and decoding the remainder.
- Centralized FRITZ!Box protocol-required MD5 content-authentication calculations through the scoped digest helper while preserving protocol compatibility.

## Compatibility

- v0.8.91 does not add or alter database schema.
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
