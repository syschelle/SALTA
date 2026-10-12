# SALTA v0.8.115

SALTA v0.8.115 improves automation troubleshooting without changing thermostat control behavior.

## Automation workflow export

- Every automation card now has **Copy workflow**.
- The automation overview also has **Copy workflows** to export all rules at once.
- The clipboard payload is formatted JSON designed for troubleshooting and contains the complete canonical trigger, condition and ordered action/wait sequence.
- Referenced devices are resolved with name, source, type, model, room, reachability, capabilities and current state.
- For OpenCCU devices only a diagnostic allow-list of thermostat/channel metadata is included. Connection hosts, passwords, tokens and other credentials are not exported.
- A fallback copy method is included for local HTTP installations where the modern browser Clipboard API is unavailable.

## Richer system log diagnostics

- Each automation execution now logs the complete loaded sequence before execution.
- A final execution summary is written even when all actions fail or are skipped.
- Per-step entries include the resolved target and its state before/after the action where available.
- OpenCCU commands log the exact `Interface.setValue` write parameters SALTA applied or attempted: interface, channel address, value key, value type and value.
- Failed OpenCCU commands additionally include how many writes completed and the mapped OpenCCU error information.
- Credentials and session tokens are never included.

The existing system-log retention remains bounded at 100 entries and 30 days.

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

Do not use `docker compose down -v` during the update.
