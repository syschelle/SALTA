# SALTA v0.8.89

SALTA v0.8.89 polishes the new browser-localized sidebar controls. The language selector in the sidebar footer now uses a compact stacked layout so the label no longer gets squeezed or clipped by the dropdown.

## v0.8.89 sidebar selector compactness

- Adjusted the sidebar footer language selector layout so the label and dropdown no longer compete for the same horizontal space.
- The sidebar language control now stacks its label above the selector while keeping the selector itself compact and right-aligned.
- The dropdown width in the sidebar footer is intentionally constrained so the control looks cleaner and does not dominate the whole row.
- This change affects the compact sidebar control only; the full-size language selector in **Settings → Appearance** remains unchanged.
- Added frontend regression coverage that requires the compact stacked sidebar language-control layout.
- No backend logic, database schema, localization catalog, HomeKit behavior, automation behavior, mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.88 CodeQL security hardening

- Fixed CodeQL alert **#13 / Incomplete multi-character sanitization** in `src/openccu-xmlrpc.ts`.
- Removed the XML tag-stripping fallback and now reject unknown XML-RPC fragments containing markup.
- Centralized the FRITZ!Box protocol-required MD5 content-authentication calculations through the existing digest helper instead of direct literal `createHash("md5")` calls.
- Existing FRITZ!Box Presence protocol compatibility remains unchanged.

## v0.8.87 localized formatter regression-test fix

- Fixed the isolated device-energy formatter test so it injects the `appI18n.formatNumber()` dependency used by the browser runtime.
- Runtime localization behavior remained unchanged.

## v0.8.86 German/English localization

- Added browser-localized German and English UI support with **Automatic**, **Deutsch** and **English** language choices.
- Added shared `public/i18n.js` runtime plus external `public/i18n/de.json` and `public/i18n/en.json` translation catalogues.
- Language preference remains browser/device-local through the `salta_language` cookie.

## Compatibility

- v0.8.89 changes only frontend sidebar layout/CSS, a regression test and release metadata.
- Existing language selection, Appearance settings, Favorites, Presence profiles, OpenCCU realtime button events, Vacation mode, Heating mode, multi-condition automations and daily time triggers remain unchanged.
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
