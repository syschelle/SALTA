# SALTA v0.8.140

SALTA v0.8.140 adds explicit deCONZ gateway health diagnostics and makes classic HomeMatic/BidCos low-battery service states available to SALTA's existing Pushover battery monitor.

## Changes

- Distinguish a reachable deCONZ REST API from a healthy Zigbee radio.
- Report deCONZ gateway health as `ok`, `radio-disconnected`, `api-unreachable` or `unknown`.
- Treat `rfconnected=false` or firmware `0x00000000` as a disconnected Zigbee radio while keeping the REST connection state visible.
- Expose firmware, radio state and Zigbee channel through the existing Phoscon/deCONZ gateway status API.
- Show a clear Zigbee radio warning in the SALTA Zigbee page and deCONZ settings status.
- Write persistent `DECONZ_GATEWAY_HEALTH_WARNING`, `DECONZ_GATEWAY_HEALTH_ERROR` and `DECONZ_GATEWAY_HEALTH_RECOVERED` diagnostics on health transitions.
- Read the physical maintenance channel `:0` for classic `BidCos-RF` OpenCCU devices.
- Merge classic HomeMatic `LOWBAT` service state into the visible SALTA device state so the existing battery monitor can send Pushover warnings.
- Identify OpenCCU/HomeMatic low-battery entries in the aggregated Pushover message.
- Keep HmIP maintenance handling separate and unchanged.

## Root Cause

The deCONZ REST endpoint can remain reachable while the ConBee radio is not initialized. In that state SALTA previously reported the integration as connected because REST and WebSocket communication still worked, even though deCONZ itself reported `rfconnected=false` and could expose firmware as `0x00000000`. The available gateway fields were already parsed, but SALTA did not classify or surface that degraded radio state explicitly.

SALTA also already had a generic Pushover battery monitor and could map `LOWBAT`/`LOW_BAT` when those values were present on a discovered OpenCCU channel. Classic HomeMatic/BidCos service values such as `LOWBAT` are normally exposed on the physical device maintenance channel `:0`. SALTA intentionally excludes maintenance channels from the visible device catalogue, so the classic BidCos low-battery state was not being read into the visible thermostat or sensor and therefore could not reach the existing battery monitor.

v0.8.140 keeps maintenance channels hidden as devices, but polls the classic `BidCos-RF` physical channel `:0` once per physical device and merges its service values into the visible device state. HmIP is intentionally not routed through this BidCos-specific behavior.

## Compatibility

- Direct upgrade from v0.8.139 is supported.
- No database schema migration is required.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain unchanged.
- Existing HomeKit pairing is preserved; no reset or re-pair is required.
- Existing Phoscon/deCONZ API keys and OpenCCU credentials remain unchanged.
- Existing Zigbee and HomeMatic device IDs, room assignments and automations remain unchanged.
- No device re-pairing or re-import is required.
- No new mandatory environment variable, dependency or deployment-topology change is required.
- HmIP thermostat and maintenance behavior remains unchanged by the BidCos battery addition.

## Tests

- Regression coverage verifies healthy and radio-disconnected deCONZ gateway classification.
- Regression coverage verifies that the frontend surfaces a reachable deCONZ instance with a disconnected radio as a warning.
- Regression coverage verifies that only classic `BidCos-RF` devices derive a maintenance address from physical channel `:0`.
- Regression coverage verifies that a classic `HM-CC-RT-DN` thermostat receives `lowBattery=true` when its physical maintenance channel reports `LOWBAT=true`.
- Regression coverage verifies that HmIP channel state is not implicitly merged with the BidCos maintenance path.
- Regression coverage verifies that multiple channels of one physical OpenCCU device produce one aggregated battery warning.
- The release validator enforces the deCONZ health and BidCos battery contracts.
- The complete SALTA release validator, JavaScript syntax checks, TypeScript production build, Vitest suite and npm audit must pass in GitHub Actions before release.

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
