# SALTA v0.8.130

SALTA v0.8.130 makes OpenCCU XML-RPC callback registration recover reliably after SALTA container restarts, including hard container replacements where the previous process could not unregister cleanly.

## Changes

- SALTA now proactively clears any stale OpenCCU XML-RPC registration for its callback URL before registering the current SALTA instance ID.
- Callback cleanup uses the official HomeMatic XML-RPC `init(url, interface_id)` contract: the callback URL stays unchanged and `interface_id` is empty when unregistering.
- Normal SALTA shutdown now uses the same correct unregister semantics.
- Callback lifecycle logs include the callback URL for startup cleanup, registration and clean shutdown diagnostics.
- Existing classic HomeMatic/BidCos contact `STATE=true/false` handling remains unchanged.
- The 60-second OpenCCU polling path remains available as fallback and reconciliation.

## Root Cause

Production packet capture proved that OpenCCU delivered the `HM-Sec-SCo` door contact events to the SALTA callback URL, but the updated SALTA process still showed only `openccu-poll` as the contact-state origin. A hard container replacement can leave the previous XML-RPC callback registration behind because the old process never reaches its shutdown cleanup.

SALTA also used the HomeMatic XML-RPC unregister parameters in the wrong direction: it sent an empty callback URL together with the old instance ID. The official HomeMatic XML-RPC contract requires unregistering the same callback URL with an empty `interface_id`.

v0.8.130 corrects shutdown unregister behavior and, more importantly, performs an explicit stale-registration cleanup for the callback URL before every fresh process registration. This makes the callback lifecycle recover after both clean and hard SALTA restarts.

## Compatibility

- No database schema change or migration is required.
- Existing automations require no editing.
- Existing OpenCCU device mappings and classic BidCos contact semantics remain unchanged.
- The SALTA callback port remains TCP 18099 and BidCos-RF XML-RPC remains on port 2001.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.

## Tests

- Regression coverage verifies that stale callback cleanup uses the same callback URL with an empty interface ID.
- Regression coverage verifies that stale cleanup occurs before registration of the current SALTA instance ID.
- Regression coverage verifies that clean shutdown also unregisters the same callback URL with an empty interface ID.
- Release-validator coverage enforces the corrected callback lifecycle contract.
- Release validator passed for SALTA v0.8.130.
- JavaScript syntax checks passed.
- TypeScript production build passed.
- Test symbol preflight passed for 99 test files.
- 99 of 99 test files passed.
- 563 of 563 tests passed.

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
