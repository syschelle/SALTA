# SALTA v0.8.42

SALTA v0.8.42 adds an automatic Summer-mode thermostat guard and optional Pushover DEBUG notifications. The guard periodically verifies that compatible thermostats remain in SALTA's OFF state and repairs unintended mode drift without requiring manual intervention.

## Summer-mode thermostat guard

- Added a background thermostat guard that runs every 12 hours while global Summer mode is active.
- Added a short startup check after SALTA has had time to initialize its device integrations.
- The guard inspects all thermostats that support SALTA system-mode control.
- Thermostats already reported as OFF are left untouched.
- Any thermostat that has drifted back to Manual, Automatic, heating or another non-OFF state is sent the existing `setThermostatMode: off` system command.
- The correction reuses the existing OpenCCU thermostat-mode implementation. On devices without a native OFF mode, SALTA continues to represent OFF as manual/hand mode at the thermostat's minimum target temperature.
- The guard is inactive in Winter mode and does not alter the configured Winter operating mode.
- Automatic corrections and correction failures are recorded in the existing System Log; successful no-op checks do not add log noise.

## Optional Pushover DEBUG mode

- Added a configurable **DEBUG-Pushover** switch under the existing Pushover settings.
- DEBUG-Pushover is independent of the weekly battery-warning enable switch and only requires valid stored Pushover credentials.
- When DEBUG-Pushover is enabled, SALTA sends a diagnostic notification when the Summer-mode guard actually corrects thermostat drift or when a correction fails.
- Routine 12-hour checks where every thermostat is already correct do not send a Pushover message.
- Diagnostic messages contain thermostat names and correction status but never credentials, tokens or other secrets.
- The DEBUG setting is persisted through the existing `notification_state` storage, so no database schema migration is required.
- Disaster Recovery backups automatically include the DEBUG setting through the existing notification-state backup data.

## Compatibility

- Builds on the released SALTA v0.8.41 baseline.
- No destructive database migration is required.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- Existing Shelly, Zigbee/Phoscon, OpenCCU/HomeMatic, FRITZ!Box Presence, automations, rooms, HomeKit preparation, climate mode, battery warning, Daylight and Disaster Recovery behavior remains compatible.
- Existing v0.8.41 Disaster Recovery backups remain compatible because the new DEBUG setting does not add a required database column.

## Production update

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

No HomeKit storage migration is required when updating from v0.8.41. Existing installations where HomeKit has never been enabled or paired do not need to run `migrate-homekit-storage.sh`.
