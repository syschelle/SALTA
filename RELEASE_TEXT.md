# SALTA v0.8.114

SALTA v0.8.114 fixes an OpenCCU thermostat command-routing issue affecting temperature actions in automations.

## Fixed: target temperature no longer changes thermostat mode

- The automation action **Set target temperature** now changes only the thermostat's target-temperature datapoint.
- On classic BidCos/HomeMatic thermostats SALTA writes the discovered target datapoint, normally `SET_TEMPERATURE`.
- On HmIP thermostats SALTA keeps using the discovered target datapoint, normally `SET_POINT_TEMPERATURE`.
- Temperature-only actions no longer write `MANU_MODE`, `AUTO_MODE`, `CONTROL_MODE`, or any other operating-mode datapoint.
- Thermostat operating mode is changed only by an explicit thermostat-mode/heating-mode action.
- This applies identically to scheduled automation runs and the v0.8.113 **Run now** function.

## Root cause

v0.8.112 tried to preserve classic HomeMatic Manual mode by translating target-temperature writes into `MANU_MODE=<temperature>` whenever SALTA saw Manual or OFF. That coupled two independent operations and could leave the physical thermostat in an unintended OFF state. v0.8.114 restores strict separation between target temperature and thermostat mode.

## Compatibility

- No database schema change or migration is required.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing automations require no editing.
- Existing PostgreSQL and SALTA runtime volumes remain compatible.
- Existing HomeKit pairing state remains compatible.

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
