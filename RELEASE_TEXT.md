# SALTA v0.8.119

SALTA v0.8.119 makes OpenCCU thermostat target-temperature actions use the live device state as their decision source and verifies the resulting state before reporting success.

## Changes

- OpenCCU thermostat target-temperature commands now read the current `VALUES` paramset from the actual OpenCCU channel immediately before planning the command.
- SALTA no longer relies on its local device-registry snapshot to decide whether a thermostat is currently OFF, Manual or Auto for a target-temperature action.
- While SALTA is in Winter mode, a thermostat that is confirmed OFF by the live OpenCCU read is restored to Manual before the requested target temperature is written.
- For classic BidCos/HomeMatic thermostats such as `HM-TC-IT-WM-W-EU`, an OFF-to-Manual recovery at 15 °C sends the ordered native writes `MANU_MODE=15` followed by `SET_TEMPERATURE=15`.
- A thermostat already confirmed as Manual keeps the normal target-only path and receives only its discovered target-temperature datapoint.
- Summer mode does not perform the Winter OFF-to-Manual recovery.
- After the write sequence, SALTA reads the OpenCCU channel again and verifies the requested target temperature. When an OFF-to-Manual recovery was required, the readback must also report Manual mode.
- Readback is retried with a small bounded delay to allow OpenCCU/HomeMatic state propagation.
- A command is no longer reported as successful merely because `Interface.setValue` returned without an RPC error. Missing or mismatched readback produces an explicit command failure instead.
- The SALTA device registry is updated from the verified OpenCCU readback rather than an optimistic locally projected thermostat state.
- OpenCCU command diagnostics now record the live state before the command, exact ordered writes, readback state, number of readback attempts, Winter recovery decision and verification result.
- HmIP thermostat routing remains metadata-driven and continues to use the datapoints discovered for the actual HmIP family; no classic BidCos behavior is blindly transferred to HmIP.

## Root Cause

The v0.8.118 diagnostic proved that SALTA could send `MANU_MODE=15` successfully and receive a successful OpenCCU RPC response while the next real OpenCCU synchronization still reported the wall thermostat as OFF at 4.5 °C.

The underlying control-path weakness was therefore more fundamental than the individual BidCos write choice: SALTA planned thermostat target commands from its local registry state and treated a successful `Interface.setValue` call as proof that the thermostat state had changed. Neither assumption verifies what OpenCCU reports after the command.

v0.8.119 changes the control path to **read → decide → write → read back and verify**. The fresh OpenCCU state determines whether Winter-mode Manual recovery is required, and the post-command OpenCCU state determines whether the action is actually successful.

## Compatibility

- No database schema change or migration is required.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing automations require no editing.
- Existing PostgreSQL and SALTA runtime volumes remain compatible.
- Existing HomeKit pairing state remains compatible.
- The new preflight/readback logic applies to OpenCCU thermostat target-temperature commands only.
- Classic BidCos devices use their discovered HomeMatic mode and target datapoints.
- HmIP devices continue to use their own discovered mode/status and target-temperature metadata.
- Non-thermostat OpenCCU commands are unchanged.

## Tests

- Regression coverage verifies live OpenCCU OFF detection in Winter mode, ordered Manual recovery and target-temperature write, and verified Manual/target readback.
- Regression coverage verifies that a thermostat already reported as Manual receives only the target-temperature write.
- Regression coverage verifies that Summer mode does not perform the Winter OFF-to-Manual recovery.
- Existing classic BidCos, HmIP, automation, diagnostic-export and OpenCCU adapter regression coverage remains enabled.
- Release validator, JavaScript syntax checks, TypeScript build and the complete Vitest suite are executed by GitHub Actions before release.

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
