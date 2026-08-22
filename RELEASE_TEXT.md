# SALTA v0.8.95

SALTA v0.8.95 prevents deCONZ button-state replays after network, router, VM or deCONZ connectivity interruptions from being interpreted as fresh physical button presses. A recovered deCONZ connection now establishes a button-state baseline before automation events are allowed again, and WebSocket button delivery requires a genuinely new deCONZ `lastupdated` revision.

## v0.8.95 deCONZ reconnect button-event safety

- Added a deCONZ button recovery state that becomes active when the realtime WebSocket closes/errors or a normal REST reconciliation fails.
- The first successful full deCONZ reconciliation after an interruption is treated as a **baseline** for button resources.
- Button values and `lastupdated` revisions discovered during that recovery baseline are stored, but **no automation `deviceEvent` is emitted** from them.
- Once the baseline has completed successfully, normal button processing resumes automatically; no fixed 10/30/60-second suppression window is used.
- WebSocket button events now require a non-empty `lastupdated` revision that differs from the revision already stored for that button. A repeated WebSocket snapshot with the same revision is not treated as a new press.
- Poll/WebSocket button updates received while a recovery baseline is pending update the stored baseline state without triggering automations.
- The v0.8.91 cross-transport exact-once deduplication remains active, so genuine button events can still be recovered by poll/reconcile in steady-state without duplicate automation runs.
- Added deCONZ recovery diagnostics to the existing internal `phoscon` log source:
  - `DECONZ_WEBSOCKET_CONNECTED`
  - `DECONZ_WEBSOCKET_ERROR`
  - `DECONZ_WEBSOCKET_CLOSED`
  - `DECONZ_RECOVERY_BASELINE`
- Added regression coverage proving that a REST/network interruption followed by changed button revisions produces no replay event during recovery, while the next genuine revision does emit exactly once.
- Added regression coverage proving that duplicate or revision-less WebSocket `buttonevent` messages do not emit additional automation events.
- No database schema migration, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.94 deCONZ settings naming and direct UI link

- Renamed the visible **Settings → Phoscon** integration to **deCONZ** while preserving the internal `phoscon` adapter/source/API identifiers for compatibility.
- Added a direct **Open deCONZ interface** / **deCONZ-Oberfläche öffnen** link using the configured HTTP/HTTPS base address and opening in a new browser tab/window.

## v0.8.93 bounded command-history retention

- Added automatic retention for the existing `commands` table.
- Command records older than **90 days** are removed automatically and only the **10,000 newest records** are retained as a hard upper bound.
- Retention runs during startup and after newly persisted API commands without changing database schema.

## v0.8.92 Phoscon websocket regression-test alignment

- Aligned the stale WebSocket source-inspection test with the v0.8.91 exact-once `claimedSignature` implementation.
- Runtime behavior remained unchanged from v0.8.91.

## v0.8.91 Phoscon/deCONZ button-event reliability

- Fixed the race between normal deCONZ reconcile and the 2-second button fallback poll that could silently consume a physical button event.
- Added cross-transport exact-once deduplication for WebSocket, fallback polling and reconcile.
- Reconcile can recover a genuinely missed steady-state button event and records `buttonEventTransport: "reconcile"` when it does so.

## Compatibility

- Existing deCONZ configuration, API keys and device IDs remain compatible.
- Internal source/API identifiers remain `phoscon`; this release changes recovery behavior and diagnostic log codes, not persistence identifiers.
- Existing button automation trigger values such as `event:buttonEvent:1002` remain unchanged.
- The recovery baseline intentionally discards button-state changes accumulated while the deCONZ connection was unavailable; this prevents stale/replayed states from toggling actuators after connectivity returns.
- Genuine button presses after the successful recovery baseline continue to trigger normally.
- Existing command-history retention from v0.8.93 remains unchanged.
- Existing browser language selections, Appearance settings, Favorites, Presence profiles, OpenCCU realtime button events, Vacation mode, Heating mode, multi-condition automations and daily time triggers remain unchanged.
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
