# SALTA v0.8.45

SALTA v0.8.45 completes the first production-ready HomeKit bridge workflow and supersedes the unreleased v0.8.44 candidate. It also fixes the CI regression that incorrectly rejected the refactored HomeKit command-dispatch implementation because a test still depended on obsolete exact source-code fragments.

## HomeKit settings in the web interface

- Added a dedicated **Settings → HomeKit** page.
- HomeKit can now be enabled or disabled at runtime without restarting SALTA.
- The bridge name can be changed from the web interface.
- A specific host network interface can optionally be selected for HomeKit advertisement.
- The page shows whether the bridge is running, advertised and paired.
- The page also shows the HomeKit bridge identity, HAP port and the number of eligible and currently published SALTA devices.
- Available host network interfaces and their addresses are exposed only to the authenticated settings page to make interface selection practical.

## Secure pairing workflow

- The HomeKit pairing code is displayed only while the bridge is unpaired.
- Pairing credentials are never written to SALTA application logs.
- Once paired, the pairing code is omitted from the HomeKit settings API response and hidden in the web interface.
- Added an explicit **Reset pairing** action with a strict mutation rate limit.
- Resetting pairing removes the stored HAP accessory identity for the current bridge, generates fresh pairing credentials and republishes the bridge when HomeKit is enabled.
- Fresh installations that still use the historical bootstrap bridge identity receive a generated local bridge username and fresh HAP PIN before first publication.

## Runtime bridge lifecycle

- Refactored the HomeKit bridge into a runtime-managed SALTA service with start, stop, configure, status and pairing-reset operations.
- Enabling or disabling HomeKit no longer requires a SALTA process restart.
- Device additions, removals and HomeKit publication changes continue to synchronize with the running bridge.
- HomeKit commands use the same SALTA device command router as the web interface rather than a parallel device-control path.
- HAP pairing storage remains pinned to `/var/lib/salta/homekit` inside the persistent `salta_runtime_data` volume.

## Expanded HomeKit device support

- Continued support for compatible switches, outlets, lights, fans and window coverings.
- Added compatible thermostat publication with current temperature, target temperature and OFF/HEAT/AUTO target modes.
- A thermostat is published only when SALTA can both set its target temperature and change its operating mode.
- Added read-only HomeKit presentations for compatible motion, contact, temperature, humidity, light, water-leak and smoke sensors.
- Sensor accessories are published only when SALTA has the corresponding live state.
- Added HomeKit battery information when a SALTA device exposes battery percentage or low-battery state.
- Unsupported or incomplete devices are not exposed as misleading fallback switches.

## Production HomeKit networking

- Updated the production `docker-compose.image.yml` so the SALTA service uses host networking for direct LAN mDNS/HAP advertisement.
- The SALTA web service continues to use `WEB_PORT` and `SALTA_BIND_ADDRESS` on the host network.
- PostgreSQL remains protected from LAN access: its container port is bound only to host loopback at `127.0.0.1:${POSTGRES_HOST_PORT:-5433}`.
- SALTA connects to PostgreSQL through that loopback-bound host port when using the production image Compose stack.
- The deployment continues to use only `docker-compose.image.yml`; no second production Compose file is required.

## Persistence and Disaster Recovery

- Global HomeKit runtime settings are persisted using existing SALTA application state and encrypted secret handling; no destructive database schema migration is required.
- Existing per-device HomeKit publication metadata remains intact.
- HomeKit bridge identity, PIN and HAP pairing state continue to be included in the password-encrypted Disaster Recovery workflow.
- Existing installations upgrading from v0.8.41 or later do not require the legacy HomeKit storage migration.
- The historical one-time migration remains documented only for installations that were already paired on a pre-v0.8.41 container.

## Security

- HomeKit settings endpoints require normal SALTA authentication and existing CSRF/origin protections.
- HomeKit reads and mutations use explicit application rate limits; pairing reset has a stricter dedicated limit.
- The settings API never returns the stored `pin` field.
- Pairing codes and setup credentials are not logged.
- Invalid selected network interfaces are rejected rather than silently publishing on an unintended interface.
- PostgreSQL is not exposed to the LAN by the HomeKit networking change.

## CI regression fix

- Fixed the HomeKit shared-command-dispatcher regression test that still asserted obsolete exact source-code fragments.
- Replaced the fragile string checks with TypeScript AST inspection.
- The test now verifies the real architectural contract: `HomeKitBridge` receives a private commander and HomeKit writes are routed through `this.commander.command(...)` with the current device ID and `source: "homekit"`.
- No production HomeKit behavior was changed by this fix.

## Quality and regression coverage

- Added HomeKit API tests for paired, unpaired, update and pairing-reset behavior.
- Added frontend structural/AST-backed coverage for the HomeKit settings page and its API calls.
- Added device-presentation tests for thermostat capability completeness and read-only sensor eligibility.
- Added deployment tests for HomeKit host networking and loopback-only PostgreSQL publication.
- Extended release validation with HomeKit runtime lifecycle, persistence, UI and deployment invariants.

## Compatibility

- Builds on SALTA v0.8.43.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- No destructive database migration is required.
- Existing Shelly, Zigbee/Phoscon, OpenCCU/HomeMatic, FRITZ!Box Presence, automations, rooms, climate mode, battery warning, Daylight, DEBUG and Disaster Recovery behavior remains compatible.
- Existing `.env` HomeKit values remain supported as bootstrap defaults; runtime configuration is managed from **Settings → HomeKit** after it is saved there.

## Production update

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

No HomeKit storage migration is required when updating from v0.8.43.
