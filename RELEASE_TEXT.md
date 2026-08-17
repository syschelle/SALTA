# SALTA v0.8.86

SALTA v0.8.86 introduces browser-localized German and English user interfaces. Users can choose **Automatic**, **Deutsch** or **English** independently on each browser/device. The localization architecture uses external translation catalogues and preserves user-defined device, room, person and automation names exactly as entered.

## v0.8.86 German/English localization

- Added a shared browser localization runtime in `public/i18n.js`.
- Added external German and English translation catalogues in `public/i18n/de.json` and `public/i18n/en.json`.
- Added **Automatic**, **Deutsch** and **English** language choices.
- Added a compact language selector to the sidebar and a matching language setting under **Settings → Appearance**.
- Added the same language selection to the login page so authentication can be used in German or English.
- Language selection is intentionally browser/device-local and is stored in the `salta_language` cookie. Different clients can therefore use different SALTA languages against the same server.
- **Automatic** walks the browser's preferred-language list in order, selects German or English when supported, and falls back to German for unsupported languages.
- The localization runtime translates static UI text, newly rendered frontend fragments, placeholders, tooltips and ARIA labels.
- The English catalogue contains more than 600 explicit SALTA UI phrase translations plus dynamic patterns/tokens for rule summaries and generated counts.
- Device names, room names, person names, automation names and HomeKit display names are explicitly excluded from automatic translation and remain exactly as configured by the user.
- Added locale-aware `Intl.NumberFormat` and `Intl.DateTimeFormat` usage for dashboard values, timestamps and automation temperatures.
- Changing the language rerenders the important dynamic UI surfaces without reloading SALTA or changing persisted smart-home state.
- Localization assets are public static assets with `no-store` caching so the login page can load its selected language before a SALTA session exists and browsers do not retain stale dictionaries after an update.
- Added JSON MIME handling and explicit public static routes for `/i18n.js`, `/i18n/de.json` and `/i18n/en.json`.
- Added frontend/server regression coverage and release-validator contracts for language selection, automatic detection, catalogue completeness, user-content protection, locale formatting and unauthenticated login localization.
- The existing Light/Dark theme cookie and server-side Appearance palette remain independent from the language preference.
- No database schema migration, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.85 Appearance profile application fix

- Fixed the issue where selecting a color profile and pressing **Apply profile** did not visibly change the SALTA page.
- Named Appearance profiles now apply their palette directly to the current Light/Dark CSS variables.
- Selecting Standard, Ocean, Forest, Warm or Graphite immediately previews the selected profile.
- Individual color editing and server-side Appearance persistence remain unchanged.

## v0.8.84 Appearance regression-test maintenance

- Updated two stale frontend tests after the configurable Appearance integration.
- Authentication coverage expects the saved Appearance palette after session authentication and before normal application data loading.
- Room-group coverage verifies `#eef2ff` as the Standard `--overview-room-bg` default and verifies use of that configurable CSS variable.
- Runtime behavior was unchanged in v0.8.84.

## v0.8.83 configurable appearance profiles

- Added **Settings → Appearance** with Standard, Ocean, Forest, Warm, Graphite and Custom profiles.
- Added separate Light and Dark palettes with 27 individually editable colors per mode.
- Added exact HEX editing and native color pickers.
- Appearance settings use the existing backed-up `notification_state` persistence and require no database migration.

## Compatibility

- v0.8.86 does not add or alter database schema.
- Language preference is browser-local and does not change existing SALTA user/configuration records.
- Existing device, room, person, automation and HomeKit names are not translated or rewritten.
- Existing saved Appearance settings remain compatible and independent of language selection.
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
