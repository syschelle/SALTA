# SALTA v0.8.132

SALTA v0.8.132 adds an optional FRITZ!Box Smart Home integration while preserving the behavior of every existing installation by default.

## Changes

- Add an independent FRITZ!Box Smart Home adapter using the local Smart Home REST API.
- Add an explicit master switch plus separate opt-ins for radiator controls, outlets/switches, lights and temperature/humidity sensors.
- Keep the master switch and every category disabled by default on new and upgraded installations.
- Reuse the existing FRITZ!Box host, credentials and TLS settings without tying Smart Home enablement to presence detection.
- Map documented thermostat, on/off, level, temperature and humidity interfaces into SALTA devices.
- Support target-temperature commands for FRITZ! thermostats, on/off/toggle for switchable units and brightness for supported lights.
- Keep newly imported FRITZ!Box Smart Home devices out of HomeKit until the user explicitly enables HomeKit for that device.
- Store the Smart Home opt-in in the existing backed-up notification-state store; no database schema version change is required.

## Root Cause / Motivation

SALTA already used FRITZ!Box TR-064 for optional WLAN presence detection, but that adapter intentionally represented people/presence rather than FRITZ!Box Smart Home actuators and sensors. Mixing both concerns would make upgrades risky and could silently introduce devices into established systems.

v0.8.132 therefore adds Smart Home as a separate opt-in adapter. When the new master switch is disabled, the adapter exits before authentication or REST requests and does not create or modify FRITZ!Box Smart Home devices. This makes the new capability safe for existing installations while allowing a new installation to enable only the desired device categories.

## Compatibility

- Existing SALTA installations remain unchanged unless FRITZ!Box Smart Home is explicitly enabled.
- Existing FRITZ!Box presence settings and behavior remain independent and unchanged.
- Database schema version remains 0.5; no ALTER TABLE or manual migration is required.
- Existing Shelly, Phoscon/deCONZ, Hue, OpenCCU, virtual-device, automation and HomeKit data remain unchanged.
- Existing PostgreSQL, SALTA runtime and HomeKit volumes remain compatible.
- FRITZ!Box Smart Home REST support requires a FRITZ!OS version that provides the Smart Home REST API.
- No new npm dependency or mandatory environment variable is introduced.

## Tests

- Verify all FRITZ!Box Smart Home opt-ins default to false.
- Verify the disabled adapter performs no FRITZ!Box network request and creates no devices.
- Verify thermostat, outlet, light and sensor REST-interface mapping.
- Verify newly imported devices default to HomeKit disabled.
- Verify per-category opt-ins.
- Verify PBKDF2 Session-ID response generation and TR-064-to-web-origin normalization.
- Verify the thermostat REST command payload.
- Verify the browser UI exposes unchecked opt-in controls and never embeds FRITZ!Box credentials.
- Verify database schema version 0.5 remains unchanged and the existing notification-state persistence is used.

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
