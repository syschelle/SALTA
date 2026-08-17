# SALTA v0.8.90

SALTA v0.8.90 completes a second localization audit after the German/English UI rollout. Dynamic status lines, credential notices, diagnostics, device-information labels and several adapter-specific messages that could still remain German in an English browser are now covered. OpenCCU timestamps also follow the selected SALTA locale consistently.

## v0.8.90 localization completeness audit

- Expanded the external German/English catalogues from the initial localization set to **930 explicit UI phrases** and **97 dynamic translation patterns**.
- Added English coverage for the reported DEBUG status and Pushover diagnostic descriptions, including **DEBUG enabled** and **DEBUG · ERROR**.
- Added translations for encrypted API-key/password state messages used by Phoscon, Hue, OpenCCU and FRITZ!Box Presence.
- Added compound realtime translations for Philips Hue and Phoscon/deCONZ, including connected event streams, WebSocket status and last-event timestamps even when bridge/gateway metadata precedes them.
- Added OpenCCU gateway translations for device counts and synchronization timestamps, including interface-name prefixes.
- Added complete Heating-mode status translations such as **Current: Summer · Winter: Manual** and the supported-thermostat / last-applied / success-failure summary.
- Added notification summary translations for the last battery warning and next eligible notification time.
- Added translations for device-dialog information labels such as **Source**, **Device type**, **Password stored**, **Model**, **Channels**, **Device address**, OpenCCU channel metadata and last-seen/last-event fields.
- Added translations for the **DIAGNOSTICS & TROUBLESHOOTING** system-log heading and OpenCCU diagnostic result/detail structures.
- Added missing HomeKit pairing/compatibility messages, backup/restore status text, Presence connection states and remaining Automation validation/status messages.
- Added translations for controlled device/state labels that were still missing from the catalogue, including temperature, water, fire and carbon monoxide.
- Fixed the two remaining locale-unaware OpenCCU timestamp paths: diagnostic completion time and last synchronization now explicitly use the selected SALTA locale instead of the host/browser default locale.
- German and English phrase catalogues now contain the same source keys, and German/English dynamic pattern keys are kept in parity.
- Strengthened frontend regression coverage with representative dynamic strings from DEBUG, adapter credentials, realtime status, Heating mode, battery warnings, device metadata and diagnostics.
- Strengthened the release validator so future releases reject missing critical dynamic translations, mismatched phrase keys and locale-unaware frontend `toLocaleString()` calls.
- User-defined device, room, person, automation and HomeKit display names remain outside automatic translation.
- No database schema migration, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.89 sidebar selector compactness

- Refined the sidebar language selector so its label and dropdown no longer compete for horizontal space.
- The compact sidebar control uses a stacked layout with a constrained right-aligned selector.
- The full-size language selector under **Settings → Appearance** remains unchanged.

## v0.8.88 CodeQL security hardening

- Fixed the OpenCCU XML-RPC incomplete multi-character sanitization finding by rejecting unknown typed markup instead of stripping tags and decoding the remainder.
- Centralized FRITZ!Box protocol-required MD5 content-authentication calculations through the scoped digest helper while preserving protocol compatibility.

## v0.8.87 localized formatter regression-test fix

- Fixed the isolated device-energy formatter regression test so it injects the i18n number-formatting dependency used by the real browser runtime.

## v0.8.86 German/English localization

- Added browser-localized German and English UI support with **Automatic**, **Deutsch** and **English** language choices.
- Added the shared `public/i18n.js` runtime plus external German and English translation catalogues.
- Language preference remains browser/device-local through the `salta_language` cookie.

## Compatibility

- v0.8.90 does not add or alter database schema.
- Existing browser language selections remain compatible.
- Existing Appearance settings remain independent of language selection.
- Existing device, room, person, automation and HomeKit names are not translated or rewritten.
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
