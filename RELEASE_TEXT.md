# SALTA v0.8.113

SALTA v0.8.113 adds two practical controls directly to the automation overview: **Run now** and **Duplicate**.

## Manual Run now

- Every automation card now has a **Run now** button.
- A manual run deliberately skips the automation's **When** trigger, selected execution days and every **Only if** condition.
- It can also be used while the automation is disabled, so a rule can be tested safely before activation.
- Only the configured **Then** sequence is executed.
- Ordered actions and Wait steps use the same serialized runtime as normal automation execution, including capability/reachability checks, system actions, logs and the last-trigger timestamp.
- The new endpoint is `POST /api/automations/:id/trigger` and uses the standard mutation rate limit. The API returns `202 Accepted` immediately; long Wait sequences continue asynchronously.

## Duplicate automation

- Every automation card now has a **Duplicate** button.
- The copy preserves the room, trigger, execution-day schedule, Only-if conditions and the complete ordered action/Wait sequence.
- The duplicated rule is intentionally created **disabled** to prevent the original and its copy from firing in parallel before the copy has been reviewed.
- The copy receives `(Kopie)` in German or `(Copy)` in English.

## Compatibility

- No database schema change or migration is required.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
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
