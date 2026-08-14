# SALTA v0.8.46

SALTA v0.8.46 adds native HomeKit QR-code pairing to the SALTA web interface. The QR code is generated locally from the HomeKit setup URI so pairing data never needs to be sent to an external QR service.

## HomeKit QR-code pairing

- Added a scannable HomeKit QR code under **Settings → HomeKit** while the SALTA bridge is enabled and not yet paired.
- The QR code is generated from HAP-NodeJS `setupURI()` data and can be scanned with Apple Home using **Add Accessory**.
- The existing numeric HomeKit pairing code remains visible as a manual fallback.
- After successful pairing, both the setup URI and numeric pairing code are omitted from the authenticated settings response and disappear from the web interface.
- Resetting HomeKit pairing produces fresh pairing credentials and the QR code is regenerated automatically after the bridge is republished.

## Local-only QR generation

- Added a small SALTA-owned QR encoder for the standardized HomeKit `X-HM://` alphanumeric setup-URI format.
- QR rendering is performed entirely inside the SALTA web interface from authenticated local data.
- No external QR-code service, CDN, tracking endpoint or remote image request is used.
- No new npm dependency is introduced.
- The rendered SVG contains only the QR matrix and does not embed the HomeKit setup URI as readable SVG text or an external URL.

## Security and API behavior

- The HomeKit setup URI is returned only through the existing authenticated HomeKit settings API.
- Existing `Cache-Control: no-store` behavior continues to apply to authenticated API responses.
- Paired HomeKit status responses expose neither `pairingCode` nor `setupUri`.
- Pairing secrets continue to be excluded from application logs.

## Quality and regression coverage

- Added an independent QR Version 1-L / mask 0 reference-vector test for a representative HomeKit setup URI.
- Added frontend coverage for the QR container, local QR script and compact pairing layout.
- Extended HomeKit API tests to verify that the setup URI is available only while unpaired.
- Extended `npm run check` and release validation to syntax-check and enforce the local HomeKit QR implementation.

## Compatibility

- Builds on the released SALTA v0.8.45 baseline.
- No database migration is required.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- Existing HomeKit bridge identity, HAP pairing storage, per-device publication settings and Disaster Recovery behavior remain compatible.
- No HomeKit storage migration is required when updating from v0.8.45.

## Production update

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
