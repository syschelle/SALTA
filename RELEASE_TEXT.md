# SALTA v0.8.88

SALTA v0.8.88 addresses the four open CodeQL findings reported against the OpenCCU XML-RPC parser and FRITZ!Box Presence authentication. The OpenCCU parser no longer performs tag-stripping followed by entity decoding, while FRITZ!Box protocol-mandated MD5 calculations are centralized through the existing digest helper instead of direct literal MD5 crypto calls.

## v0.8.88 CodeQL security hardening

- Fixed CodeQL alert **#13 / Incomplete multi-character sanitization** in `src/openccu-xmlrpc.ts`.
- Removed the fallback `fragment.replace(/<[^>]+>/g, "")` sanitization pattern from XML-RPC primitive parsing.
- Bare XML-RPC values are still supported, but fragments containing unknown markup are now rejected instead of stripping tags and then decoding entities.
- Added regression coverage that feeds an unknown typed XML-RPC value containing encoded markup and verifies that no OpenCCU event is emitted.
- Addressed CodeQL alerts **#9, #11 and #12** in `src/fritzbox-presence.ts` without changing the FRITZ!Box authentication protocol.
- The official FRITZ! TR-064 protocol requires MD5-compatible digest calculations for the relevant HTTP Digest/content-level authentication exchanges. SALTA therefore retains protocol interoperability but routes the two SOAP content-authentication MD5 calculations through the existing `digestHash()` helper.
- Removed all direct literal `createHash("md5")` calls from the FRITZ!Box Presence source.
- Added regression and release-validator checks that reject future direct literal MD5 crypto calls in `src/fritzbox-presence.ts` while preserving exactly the two required SOAP `digestHash("MD5", ...)` operations.
- Updated `SECURITY.md` to document the protocol boundary explicitly: this MD5 compatibility path is not used for SALTA password storage, password derivation, sessions or administrator authentication.
- Existing FRITZ!Box Presence behavior, including rights-free requests, SOAP `InitChallenge` / `ClientAuth`, HTTP Digest fallback, TLS handling and presence polling, is unchanged.
- No database schema migration, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.87 localized formatter regression-test fix

- Fixed the single v0.8.86 CI regression in the isolated device-energy formatter test.
- The test now injects the `appI18n.formatNumber()` dependency used by the real browser application.
- German/English localization runtime behavior remained unchanged.

## v0.8.86 German/English localization

- Added a shared browser localization runtime in `public/i18n.js`.
- Added external German and English translation catalogues in `public/i18n/de.json` and `public/i18n/en.json`.
- Added **Automatic**, **Deutsch** and **English** language choices in the sidebar, Appearance settings and login page.
- Language preference remains browser/device-local through the `salta_language` cookie.
- User-defined device, room, person, automation and HomeKit names are not translated or rewritten.
- Added locale-aware number/date formatting and dynamic UI localization.

## Compatibility

- v0.8.88 does not add or alter database schema.
- Existing FRITZ!Box Presence settings and encrypted credentials remain compatible.
- The FRITZ!Box content-authentication response remains byte-compatible with the existing tested `ClientAuth` flow.
- Existing OpenCCU realtime button events remain compatible; unsupported XML-RPC value types are now rejected instead of flattened into strings.
- Existing German/English localization and Appearance settings remain unchanged.
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
