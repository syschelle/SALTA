# SALTA v0.8.94

SALTA v0.8.94 renames the visible Phoscon integration settings to **deCONZ** and adds a direct link from the settings panel to the configured local deCONZ web interface. The link opens in a new browser tab/window and is only exposed for a valid HTTP or HTTPS base address. Internal adapter identifiers and REST endpoints remain unchanged for compatibility.

## v0.8.94 deCONZ settings naming and direct UI link

- Renamed the **Settings → Phoscon** navigation entry to **Settings → deCONZ**.
- Renamed the visible integration heading, address label, pairing instructions, credential/error messages and connection notifications in that settings workflow from Phoscon wording to deCONZ wording.
- Added **Open deCONZ interface** / **deCONZ-Oberfläche öffnen** to the deCONZ settings actions.
- The direct UI link uses the configured deCONZ base address and opens with `target="_blank"` plus `rel="noopener noreferrer"`.
- The link is shown only when the configured/entered URL parses as HTTP or HTTPS; other URL schemes are rejected client-side.
- Editing the deCONZ address updates the direct UI link immediately, and loading saved settings restores the link automatically.
- Added German/English catalogue entries for the new deCONZ settings wording and direct-link label.
- Added frontend regression coverage and release-validator contracts for the deCONZ labels, safe external-link attributes, URL-scheme guard and live link update path.
- Internal compatibility identifiers such as `/api/settings/phoscon`, the `phoscon` device source and existing stored settings remain unchanged.
- No database schema migration, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.93 bounded command-history retention

- Added automatic cleanup for records in the existing `commands` table.
- Command records older than **90 days** are removed automatically.
- A hard upper bound retains only the **10,000 newest command records**.
- Retention runs during startup and after newly persisted API commands, so command history remains bounded during continuous operation.
- No schema change or manual SQL migration is required.

## v0.8.92 Phoscon websocket regression-test alignment

- Fixed the stale source-inspection assertion left behind by the v0.8.91 button-event deduplication refactor.
- Runtime Phoscon/deCONZ behavior remained unchanged from v0.8.91.

## v0.8.91 Phoscon/deCONZ button-event reliability

- Fixed the confirmed race between the normal deCONZ reconcile and the 2-second button fallback poll.
- A newly discovered `buttonevent` revision found by normal reconcile now emits the same `deviceEvent` used by realtime/fallback handling instead of silently consuming the revision.
- Added cross-transport exact-once deduplication for WebSocket, fallback polling and reconcile.
- Reconcile can recover a missed button event and records `buttonEventTransport: "reconcile"` when it does so.

## Compatibility

- v0.8.94 is a frontend/settings naming and navigation enhancement only.
- Existing deCONZ API keys and saved base addresses remain compatible.
- Existing internal `phoscon` adapter/source identifiers and API routes remain unchanged.
- Existing command-history retention from v0.8.93 remains unchanged.
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
