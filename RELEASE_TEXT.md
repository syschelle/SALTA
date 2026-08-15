# SALTA v0.8.60

SALTA v0.8.60 adds a dedicated local Philips Hue Bridge integration alongside the existing Phoscon/deCONZ adapter. Hue lights and smart plugs can remain paired with their Philips Hue Bridge while SALTA discovers, displays and controls them through the local Hue API v2, receives local realtime state-change events and makes supported Hue devices available to SALTA automations.

The release also carries forward the v0.8.59 momentary virtual-button workflow for one-shot HomeKit/geofence triggers.

## Philips Hue Bridge integration

- Added **Philips Hue** as a first-class SALTA device source parallel to Shelly, Phoscon/Zigbee and OpenCCU/HomeMatic.
- Added a dedicated **Philips Hue** page with room filtering, search, connection status and manual synchronization.
- Added **Settings → Philips Hue** with local mDNS bridge discovery, manual IP/hostname fallback, link-button pairing, application-key status and disconnect.
- SALTA pairs with the bridge using the physical Hue link button and stores the bridge-issued application key encrypted with `SALTA_ENCRYPTION_KEY`.
- The application key is never returned to the browser after it has been stored.
- Disconnecting Hue removes synchronized Hue records from SALTA but does not remove lights, accessories or configuration from the Philips Hue Bridge.

## Hue API v2 devices and controls

- Added local Hue API v2 resource discovery for Hue light resources and Hue smart plugs.
- Hue lights support `On`, `Off` and `Toggle`.
- Dimmable Hue lights expose brightness control when the bridge reports the capability.
- Color-temperature lights expose a Kelvin slider derived from the bridge-reported mirek range.
- Color-capable Hue lights expose a local color picker and SALTA converts HTML colors to Hue xy coordinates for v2 commands.
- Hue smart plugs are represented as SALTA outlets instead of lights.
- Reachability is derived from the Hue `zigbee_connectivity` resource.
- Hue model, firmware, bridge/resource identifiers and Hue archetype metadata are shown in the SALTA device details.
- Existing SALTA names, room assignments, presentation metadata and HomeKit choices are preserved across Hue reconciliation.

## Local realtime updates

- Added the Hue API v2 local SSE event stream at `/eventstream/clip/v2` using the bridge-issued application key.
- Valid Hue event frames trigger a coalesced fast reconciliation so state changes made in the Hue app or by another local Hue client appear in SALTA quickly.
- A 15-second periodic reconciliation remains active as a fallback when realtime delivery is unavailable.
- Event-stream reconnects use bounded exponential backoff and do not require restarting SALTA after a temporary Hue Bridge or network interruption.

## HTTPS and local-network security

- Hue communication is HTTPS-only.
- SALTA bundles the current Signify Hue Bridge CA roots used by updated Hue Bridge generations and keeps TLS certificate-chain verification enabled.
- After the bridge identity is discovered, authenticated requests and the realtime event stream validate the certificate against the Hue Bridge ID.
- SALTA does not use a global or Hue-specific `rejectUnauthorized: false` bypass.
- Hue targets are resolved before connection and must use private, loopback or link-local addresses; public Internet targets and non-standard HTTPS ports are rejected.
- mDNS discovery, pairing, settings writes, disconnect and manual reconciliation use explicit API rate limits in addition to SALTA's normal authenticated API protection.
- Hue credential readability is included in SALTA readiness/credential diagnostics without logging the application key.

## Automations and HomeKit

- Hue lights and plugs automatically participate in the existing automation target catalogue through the normal SALTA capability model.
- Binary Hue targets support `On`, `Off` and `Toggle` in automations.
- Hue devices are imported with SALTA HomeKit publication disabled by default to avoid creating duplicate Apple Home accessories when the Hue Bridge is already connected directly to Apple Home.
- HomeKit can still be enabled explicitly per supported Hue device in SALTA device settings.

## v0.8.59 behavior carried forward

- Virtual devices can be configured as persistent switches or 500 ms momentary buttons.
- Momentary virtual buttons remain writable HomeKit switch accessories so Apple Home geofences can activate them while SALTA resets them automatically.
- Existing virtual switches can be converted without changing their SALTA device ID or existing automation references.
- The obsolete virtual self-reset explanatory hint remains removed from the automation editor.
- Persistent virtual switches retain the safe opposite-state self-reset mechanism from v0.8.58.

## Compatibility

- No database schema migration is required; Hue credentials reuse SALTA's existing encrypted `adapter_settings` persistence.
- No manual migration is required.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- No new mandatory environment variable is required.
- No new npm dependency is introduced; the Hue client uses Node.js built-in HTTPS, DNS and networking APIs.
- SALTA continues to use `network_mode: host` for HomeKit HAP/mDNS.
- PostgreSQL remains on Docker's normal bridge network and is published only on host loopback.
- `/opt/SALTA/migrate-homekit-storage.sh` remains necessary only for HomeKit pairing state created before v0.8.41.

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
