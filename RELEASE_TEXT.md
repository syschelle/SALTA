# SALTA v0.8.129

SALTA v0.8.129 fixes delayed classic HomeMatic contact automations by binding received OpenCCU XML-RPC events directly to the live SALTA device registry.

## Changes

- OpenCCU realtime callbacks now resolve their SALTA device directly by the physical HomeMatic channel address stored in the live registry.
- Callback application no longer requires a matching entry in the periodically refreshed OpenCCU catalogue.
- Classic `HM-Sec-SCo` / `SHUTTER_CONTACT` `STATE=true` and `STATE=false` events therefore update the existing SALTA `open` state on the realtime callback path.
- The existing 60-second JSON-RPC poll remains active as fallback and reconciliation.
- Existing callback/poll serialization remains in place so stale polling data cannot overwrite a newer callback update.
- Existing OpenCCU KEY button callbacks continue to use the same realtime path.
- The contact regression now uses the exact `system.multicall` XML envelope captured from the production OpenCCU connection.

## Root Cause

Production packet capture proved that OpenCCU successfully delivered `NEQ1157537:1 / STATE / true|false` callbacks to SALTA on TCP port 18099. SALTA still showed the contact transition origin as `openccu-poll`, and the automation executed only when the 60-second poll observed the state change.

The v0.8.128 callback handler parsed the event correctly but required a matching entry from the adapter's periodically refreshed catalogue before it would look up and update the SALTA device. That catalogue dependency is unnecessary for an already discovered device and can silently discard a valid realtime event while catalogue state is stale, incomplete or recovering. The SALTA registry already contains the exact channel address and channel type required to apply the event.

v0.8.129 removes that catalogue gate from realtime event application and binds the callback directly to the live registry metadata.

## Compatibility

- No database schema change or migration is required.
- Existing automations require no editing.
- Classic HomeMatic/BidCos contact semantics remain `STATE=false = closed` and `STATE=true = open`.
- The OpenCCU callback port remains TCP 18099 and BidCos-RF registration remains on port 2001.
- The 60-second OpenCCU poll remains enabled as fallback/reconciliation.
- Existing OpenCCU KEY button callbacks remain compatible.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.

## Tests

- XML-RPC regression coverage parses the exact production `system.multicall` envelope for `HM-Sec-SCo` `STATE=true/false` callbacks.
- Runtime adapter coverage verifies that the contact updates immediately from registry metadata even with an empty OpenCCU adapter catalogue.
- Runtime coverage continues to verify that unrelated `LOWBAT` events do not change the contact `open` state.
- Existing KEY button realtime-event regression coverage remains active.
- Release validator, JavaScript syntax checks, TypeScript production build and the complete test suite must pass before release.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.
