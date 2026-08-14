# SALTA v0.8.48

SALTA v0.8.48 fixes HomeKit QR-code delivery in the authenticated SALTA web interface. The previous build referenced `/homekit-qr.js` from the page but did not register that asset in SALTA's explicit static-file map, so the SPA fallback returned `index.html` with a `text/html` MIME type and browsers correctly refused to execute it.

## HomeKit QR asset delivery

- Added `/homekit-qr.js` to SALTA's authenticated static-file map.
- The QR helper is now delivered as `text/javascript; charset=utf-8` instead of falling through to `index.html`.
- The asset keeps `Cache-Control: no-store`, consistent with the other first-party SALTA JavaScript assets.
- Existing local-only QR generation remains unchanged: no external QR service, CDN or tracking endpoint is used.

## Pairing-code consistency

- Keeps the v0.8.47 runtime pairing-code synchronization: while unpaired, SALTA exposes the effective HAP bridge pincode rather than relying only on the stored settings value.
- Pairing reset continues to generate a fresh bridge username and a fresh pairing code before republishing the bridge.
- Pairing secrets are not written to application logs.

## Regression coverage

- Extended the authenticated static-asset server test to request `/homekit-qr.js` directly.
- The test now requires HTTP 200, a JavaScript MIME type, `Cache-Control: no-store`, and actual QR helper source instead of HTML fallback content.
- Extended the release validator so a future release fails if `/homekit-qr.js` is referenced by the UI but missing from the server static-file map.
- Existing QR matrix, SVG security and frontend HomeKit tests remain in place.

## Compatibility

- Builds on SALTA v0.8.47.
- No database migration is required.
- No HomeKit storage migration is required.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- Existing HomeKit bridge identity, pairing storage, device publication settings and Disaster Recovery behavior remain compatible.

## Production update

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
