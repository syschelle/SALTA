# SALTA v0.8.53

SALTA v0.8.53 improves the HomeKit settings experience and adds central per-device publication controls directly to **Settings → HomeKit**. The release keeps the existing HomeKit protocol implementation and production network topology from v0.8.52, while making supported thermostats, contact sensors and other compatible devices much easier to publish and review.

## HomeKit settings redesign

- Reworked the HomeKit settings page into compact, clearly separated sections for bridge configuration, runtime status, pairing and device publication.
- Fixed the settings-page width calculation so the HomeKit panel and its controls remain inside the available content area instead of overflowing to the right.
- Added responsive bridge fields and status cards that shrink or wrap cleanly on narrower screens.
- Replaced the previous warning-style room notice with a neutral informational note.
- Added compact runtime cards for bridge state, pairing state, Bridge ID, HAP port and published/supported device counts.
- Added a dedicated `[hidden]` rule for the pairing section so the QR/pairing block is actually removed from the layout after the bridge is paired.

## Central HomeKit device management

- Added a new **Devices in HomeKit** section to the global HomeKit settings page.
- Lists all currently HomeKit-compatible SALTA devices grouped by SALTA room.
- Shows device type, integration source, target room and a compact live-state summary.
- Adds a direct HomeKit publication toggle for each supported device.
- Existing per-device HomeKit configuration remains available for optional HomeKit-specific names and room overrides.
- Hidden Zigbee devices remain excluded from HomeKit and their publication control is disabled with an explanatory state.

## Thermostats and OpenCCU contact sensors

- Compatible OpenCCU thermostats exposing `setTargetTemperature` and `setThermostatMode` are shown in the central HomeKit device list and can be enabled directly there.
- OpenCCU contact sensors already represented by SALTA as `contactSensor` are shown with their live **Open / Closed** state and can be published directly to HomeKit.
- Existing HomeKit battery-service behavior remains unchanged for devices that expose battery information.
- No OpenCCU protocol or device-detection relaxation was required for these devices.

## Compatibility

- Builds on the released SALTA v0.8.52 production topology.
- SALTA continues to use `network_mode: host` for HomeKit HAP/mDNS.
- PostgreSQL remains on Docker's normal bridge network and is published only on host loopback.
- No database migration is required.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- The legacy `/opt/SALTA/migrate-homekit-storage.sh` helper is still required only for HomeKit pairing state created before v0.8.41.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `down -v` during the update.
