# SALTA v0.8.121

SALTA v0.8.121 fixes the OpenCCU wire type used for floating-point thermostat commands.

## Changes

- The dedicated OpenCCU thermostat control path now converts an internal HomeMatic `float` write type to the OpenCCU JSON-API/XML-RPC wire type `double` before `Interface.setValue` is sent.
- The conversion is deliberately limited to `Interface.setValue`; unrelated OpenCCU method parameters are not reinterpreted.
- Existing `double`, `int`, `bool` and `string` write types remain unchanged.
- Thermostat command diagnostics now report the effective wire type sent to OpenCCU.
- The automation engine remains fully configurable: each workflow still determines the device, action, individual value, order and conditions.
- No VirtualDevices, group substitution, global Winter policy or hard-coded thermostat IDs are introduced by this fix.

## Root Cause

The v0.8.120 production diagnostic showed that Web/API thermostat control and the Nachtabsenkung automation reached the same dedicated thermostat controller, selected the configured physical BidCos device and attempted the requested value, but OpenCCU readback remained unchanged or returned to OFF/4.5 °C.

SALTA derived the write type `float` from HomeMatic `FLOAT` parameter metadata and passed that type into OpenCCU `Interface.setValue`. The OpenCCU JSON API forwards the supplied `type` to XML-RPC and documents the supported `Interface.setValue` types as `string`, `int`, `double` and `bool`. HomeMatic `FLOAT` values therefore have to be transported as XML-RPC `double`, not `float`.

v0.8.121 corrects only this protocol boundary. It does not change thermostat selection, automation semantics, workflow values, climate-mode policy or the v0.8.120 thermostat-controller separation.

## Compatibility

- No database schema change or migration is required.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing automations require no editing.
- Existing PostgreSQL and SALTA runtime volumes remain compatible.
- Existing HomeKit pairing state remains compatible.
- Classic BidCos and HmIP thermostat selection and routing remain unchanged.
- Non-thermostat OpenCCU behavior and automation policy are unchanged.

## Tests

- Regression coverage verifies that `float` becomes `double` for `Interface.setValue`.
- Regression coverage verifies that `double`, `int`, `bool` and `string` remain unchanged.
- Regression coverage verifies that unrelated OpenCCU method parameters are not rewritten.
- Existing OpenCCU thermostat-controller, automation, HomeKit and adapter regression coverage remains enabled.
- Release validator passed for SALTA v0.8.121.
- JavaScript syntax checks passed.
- TypeScript production build passed.
- Test symbol preflight passed for 97 test files.
- 97 of 97 test files passed.
- 552 of 552 tests passed.

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
