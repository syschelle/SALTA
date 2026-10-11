# SALTA v0.8.103

SALTA v0.8.103 is a security-focused dependency maintenance release. It updates the vulnerable npm dependency paths reported against v0.8.102 without changing SALTA runtime features, database schemas, configuration formats or deployment topology.

## v0.8.103 dependency security refresh

- Updated Fastify from the vulnerable v0.8.102 lockfile release to `5.12.5`.
- Updated the Fastify/AJV `fast-uri` path to `3.1.8` and the `fast-json-stringify` path to `4.2.2`.
- Updated Vitest and `@vitest/mocker` from the 3.x line to `4.1.11`.
- The vulnerable `tinypool@1.1.1` dependency pulled in by the old Vitest toolchain is no longer present in the resolved v0.8.103 dependency tree.
- Updated `source-map-js` from `1.2.1` to `1.2.2`.
- Retained the existing `find-my-way@9.7.0` security override and the reproducible `@homebridge/dbus-native@0.7.7` override.
- Added regression tests and release-validator checks for the patched Fastify, fast-uri, Vitest/@vitest/mocker, Tinypool and source-map-js security floors so a later lockfile refresh cannot silently reintroduce the reported vulnerable versions.
- The v0.8.103 lockfile was regenerated from the public npm registry in GitHub Actions, installed with `npm ci`, and verified with the complete `npm run check` quality gate before the release package was assembled.
- No SALTA application feature, REST contract, HomeKit behavior, automation behavior or database schema is changed by this release.

## v0.8.102 hourly thermostat-mode enforcement carried forward

- Winter mode always sends **manual/Handbetrieb** to every compatible thermostat.
- Summer mode sends **off/Aus** to every compatible thermostat.
- The former configurable Automatic Winter mode remains removed.
- SALTA verifies the active heating-mode policy once per hour and repairs thermostat drift to `manual` in Winter or `off` in Summer.
- Existing persisted `winter_mode='auto'` values are normalized idempotently to `manual`.

## v0.8.101 fixed-IP presence recovery carried forward

- FRITZ!Box presence targets can use a configured fixed IP address alongside the known MAC address.
- If an iPhone/iPad private Wi-Fi MAC changes while the fixed IP remains the same, SALTA can resolve the host by IP and automatically refresh the stored MAC.
- The AVM direct IP lookup and generic Hosts-table fallback remain unchanged.
- The additive `presence_target_network` persistence and backup/restore support remain unchanged.

## v0.8.100 delayed contact trigger carried forward

- Window and door contacts support **Closed for 10 seconds**.
- Reopening before the 10-second interval expires cancels the pending trigger.
- Existing immediate **Open** and **Closed** triggers remain unchanged.

## v0.8.99 native timed Shelly action carried forward

- Shelly automations support **On for seconds** with a configurable whole-number duration from 1 to 86400 seconds.
- Shelly Gen1 uses its native `timer` query parameter; Gen2/Gen3/Gen4 RPC devices use `toggle_after`.
- The one-shot timer remains device-side and does not depend on a later SALTA switch-off command.

## Persistence and deployment compatibility

- No database schema change is required.
- No `ALTER TABLE` statement or manual SQL migration is required.
- Existing PostgreSQL and SALTA runtime volumes remain compatible and must be preserved.
- No new mandatory environment variable is introduced.
- SALTA continues to use `network_mode: host` for HomeKit/mDNS while PostgreSQL remains bound to host loopback through `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL and SALTA runtime volumes.
