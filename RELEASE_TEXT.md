# SALTA v0.8.100

SALTA v0.8.100 adds a debounced contact automation trigger for window and door sensors: **Closed for 10 seconds**. The automation fires only when a contact changes to closed and remains closed continuously for the full 10-second interval. If the contact opens again before the timer expires, the pending trigger is cancelled.

## v0.8.100 contact trigger: Closed for 10 seconds

- Added **Closed for 10 seconds** to the automation trigger value choices for contact sensors.
- The option is exposed only for devices of type `contactSensor` using the canonical `open` state.
- Existing immediate **Open** and **Closed** trigger choices remain unchanged.
- SALTA starts the timer only on an actual transition from open to closed; repeated updates while the contact is already closed do not restart or duplicate the timer.
- If the contact opens again before 10 seconds have elapsed, SALTA cancels the pending trigger.
- When the 10-second interval expires, SALTA re-checks that the automation still exists and is enabled, that the configured trigger is still present, that the device is reachable and that the contact is still closed before queuing the rule.
- Pending contact timers are cleared when the automation is changed, removed, the device is removed, or the automation engine stops.
- Added regression coverage for successful delayed execution, cancellation after reopening and rejection of unsupported held-state combinations.
- Added frontend regression coverage ensuring the 10-second option is offered only for contact sensors.

## Persistence and compatibility

- The delayed contact trigger uses the existing automation trigger persistence and is encoded in the stored trigger state key.
- No database schema change is required.
- No `ALTER TABLE` statement or manual SQL migration is required.
- Existing automations remain compatible and keep their current immediate trigger behavior unless the new option is explicitly selected.
- Existing PostgreSQL and SALTA runtime volumes remain compatible and must not be deleted during the update.
- No new mandatory environment variable or npm dependency is introduced.

## v0.8.99 native timed Shelly automation action carried forward

- Carries forward the Shelly automation action **On for seconds** with a freely configurable whole-number duration from 1 to 86400 seconds.
- Shelly Gen1 continues to use `/relay/<channel>?turn=on&timer=<seconds>`.
- Shelly Gen2, Gen3 and Gen4/RPC devices continue to use `Switch.Set` with `on: true` and `toggle_after: <seconds>`.
- The Shelly-native one-shot timer remains device-side and does not depend on a later SALTA switch-off command.
- The additive `automation_timed_actions` persistence and backup/restore compatibility introduced in v0.8.99 remain unchanged.

## v0.8.98, v0.8.97 and v0.8.96 automation improvements carried forward

- Carries forward the v0.8.98 isolated frontend test-sandbox fix.
- Carries forward the v0.8.97 exact weekday API typing fix.
- Carries forward the v0.8.96 optional Monday-through-Sunday automation execution restrictions and weekend convenience control.
- Existing automations without schedule restrictions continue to run on all seven days.

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
