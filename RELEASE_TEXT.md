# SALTA v0.8.128

SALTA v0.8.128 makes classic HomeMatic/OpenCCU contact-state automations react immediately to XML-RPC STATE callbacks instead of relying only on the 60-second polling cycle.

## Changes

- Classic HomeMatic contact channels such as `SHUTTER_CONTACT` now process OpenCCU XML-RPC `STATE=true` and `STATE=false` callbacks in real time.
- Contact callbacks update the existing SALTA boolean `open` state, so existing automations such as `Contact = Open` use the faster event path without being reconfigured.
- OpenCCU realtime events are serialized with JSON-RPC polling/reconciliation to prevent stale polling results from overwriting a newer callback state.
- Callback registration now includes interfaces containing supported contact channels as well as HomeMatic KEY channels.
- The existing 60-second JSON-RPC polling path remains active as fallback and reconciliation.
- Contact adapter diagnostics record whether the last observed state transition came from `openccu-xmlrpc` or `openccu-poll`, together with transport, datapoint, value and timestamp.
- Existing realtime KEY button events remain unchanged.

## Root Cause

SALTA already registered an OpenCCU XML-RPC callback, but the runtime handler accepted only HomeMatic KEY events such as `PRESS_SHORT`. Normal contact `STATE` callbacks were parsed by the XML-RPC layer but discarded by the OpenCCU adapter. As a result, a classic BidCos contact automation could react only after the next 60-second JSON-RPC reconciliation noticed the `STATE` transition.

v0.8.128 extends the existing callback path to classic contact sensors and serializes callback handling with polling so the registry cannot be reverted by an older concurrent polling snapshot.

## Compatibility

- No database schema change or migration is required.
- Existing automations require no editing.
- Classic HomeMatic/BidCos contact semantics remain `STATE=false = closed` and `STATE=true = open`.
- The existing 60-second OpenCCU polling path remains enabled.
- Existing OpenCCU KEY button callbacks remain compatible.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.

## Tests

- Regression coverage parses real XML-RPC-style `STATE=true` and `STATE=false` callbacks for the classic `HM-Sec-SCo` / `SHUTTER_CONTACT` shape.
- Regression coverage verifies that only supported contact `STATE` datapoints map to the SALTA `open` state.
- Integration-contract coverage verifies contact-interface callback registration, polling/callback serialization and diagnostic origin metadata.
- Release validator passed for SALTA v0.8.128.
- JavaScript syntax checks passed.
- TypeScript production build passed.
- Test symbol preflight passed for 99 test files.
- 99 of 99 test files passed.
- 561 of 561 tests passed.

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
