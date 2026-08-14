# SALTA v0.8.47

SALTA v0.8.47 fixes the remaining HomeKit pairing UI/runtime issues found in the real-world validation of the v0.8.46 candidate. The HomeKit QR code is now rendered reliably in the web interface and the displayed manual pairing code is synchronized with the effective runtime bridge pin.

## HomeKit pairing fixes

- Fixed the HomeKit pairing QR code rendering in the SALTA web interface.
- The generated QR SVG now includes explicit width and height attributes so it is rendered reliably in browsers instead of collapsing to an empty box.
- Improved the HomeKit pairing panel styling so the QR area keeps a stable square layout.
- The displayed numeric pairing code is now synchronized with the effective runtime HomeKit bridge pin instead of trusting only the stored settings value.
- SALTA now reads the active HomeKit pincode from HAP accessory storage for unpaired bridges and uses that value in the HomeKit settings API response.
- This prevents mismatches where the web interface could show a pairing code that no longer matches the actively published HomeKit bridge.

## Pairing reset hardening

- Resetting HomeKit pairing now generates both a fresh HomeKit pairing code and a fresh bridge username / bridge identity.
- Existing pairing storage for the previous bridge username is cleaned up before the bridge is republished.
- This makes pairing resets more deterministic and avoids stale bridge-state reuse.

## Security and API behavior

- The HomeKit setup URI continues to be returned only through the authenticated HomeKit settings API while the bridge is unpaired.
- Paired HomeKit status responses still omit both `pairingCode` and `setupUri`.
- Pairing secrets continue to be excluded from application logs.
- The QR SVG still contains no external `href`, `src` or `xlink:href` resources and no plain-text `X-HM://` setup URI.

## Quality and regression coverage

- Added regression coverage for the explicit QR SVG dimensions.
- Kept the SVG security regression check while allowing the mandatory W3C SVG namespace.
- Kept the independent QR reference-vector regression coverage for the HomeKit setup URI encoder.
- Release validation remains aligned with SALTA v0.8.47.

## Compatibility

- Supersedes the unreleased SALTA v0.8.46 candidate.
- No database migration is required.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- Existing HomeKit bridge identity, per-device publication settings and Disaster Recovery behavior remain compatible.
- Updating from v0.8.45 or a local v0.8.46 test deployment does not require a HomeKit storage migration.

## Production update

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
