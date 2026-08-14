# SALTA v0.8.43

SALTA v0.8.43 promotes runtime diagnostics to a system-wide DEBUG level under General settings and makes an active DEBUG state immediately visible in the SALTA header. It also hardens the release-version workflow after the initial v0.8.43 tag was created from source metadata that still reported v0.8.42.

## System-wide DEBUG levels

- Moved DEBUG configuration from the Pushover notification panel to **Settings → General**.
- Replaced the previous boolean DEBUG switch with three explicit levels: `Off`, `Errors` and `Verbose`.
- `Off` keeps normal runtime behavior and suppresses DEBUG Pushover messages.
- `Errors` sends DEBUG Pushover messages when an automatic diagnostic or corrective action fails.
- `Verbose` also reports successful automatic corrections that required SALTA intervention.
- Routine 12-hour Summer-mode checks where every thermostat is already correct remain silent at every DEBUG level.
- DEBUG notification behavior remains independent from the weekly battery-warning enable switch and still requires valid stored Pushover credentials for delivery.

## DEBUG status in the header

- Added a persistent header badge whenever DEBUG is active.
- The badge shows the active level as `DEBUG · ERRORS` or `DEBUG · VERBOSE`.
- The indicator is loaded from the General settings API and updates immediately after the DEBUG level is saved.
- The badge disappears completely when DEBUG is set to `Off`.

## Backward compatibility

- Existing v0.8.42 installations that stored the former boolean DEBUG flag remain compatible.
- A legacy enabled DEBUG flag is interpreted as `Verbose`; a disabled or missing value is interpreted as `Off`.
- DEBUG settings continue to use the existing `notification_state` persistence, so no database schema migration is required.
- Disaster Recovery backups continue to include the DEBUG state through the existing notification-state data.

## Release and deployment reliability

- Corrected all active SALTA version surfaces to v0.8.43, including package metadata, runtime health responses, backup metadata, frontend version display, GHCR defaults and deployment tests.
- Hardened `scripts/set-version.mjs` so future version bumps update only current release surfaces instead of blindly rewriting historical compatibility references.
- Restored HomeKit migration documentation to the actual pre-v0.8.41 compatibility boundary.
- CodeQL Advanced Setup continues to analyze both JavaScript/TypeScript and GitHub Actions. No CodeQL language is disabled.

## Compatibility

- Builds on the released SALTA v0.8.42 baseline.
- No destructive database migration is required.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- Existing Shelly, Zigbee/Phoscon, OpenCCU/HomeMatic, FRITZ!Box Presence, automations, rooms, HomeKit preparation, climate mode, battery warning, Daylight and Disaster Recovery behavior remains compatible.

## Production update

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

No HomeKit storage migration is required when updating from v0.8.42.
