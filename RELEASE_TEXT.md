# SALTA v0.8.97

SALTA v0.8.97 fixes the TypeScript build regression introduced with the v0.8.96 weekday execution schedule API. The runtime schedule behavior is unchanged: the API schema now preserves the literal weekday type `1 | 2 | 3 | 4 | 5 | 6 | 7` instead of widening validated values to `number[]`, so the parsed request is assignable to `AutomationWeekday[]` without casts.

## v0.8.97 weekday API type-safety build fix

- Fixed the GitHub CI TypeScript errors in `src/server.ts` when creating or updating an automation with `executionDays`.
- Replaced the broad `z.number().int().min(1).max(7)` execution-day element schema with an explicit Zod literal union for values `1` through `7`.
- The inferred Zod request type now matches `AutomationWeekday[]` directly.
- Added an explicit `AutomationInput` return type to `normalizeAutomationInput()` so future API/engine type drift is caught at the normalization boundary.
- Added a regression test that requires the literal weekday schema and rejects a return to the broad `number[]` schema.
- Strengthened release validation for the same contract.
- No runtime scheduling semantics, database schema, frontend behavior, mandatory environment variable, dependency or deployment topology changed.

## v0.8.96 optional weekday and weekend automation schedules

- Added optional per-automation execution-day restrictions for Monday through Sunday.
- Existing automations continue to run on all seven days by default.
- Added the weekend convenience control and local-timezone day evaluation for device, event and time triggers.
- Added the additive `automation_schedule_preferences` table and backup/restore support without altering the existing `automations` table.

## v0.8.95 deCONZ reconnect button-event safety

- Added a recovery baseline after deCONZ/network interruptions so replayed button states do not trigger automations.
- Required genuinely new deCONZ `lastupdated` revisions for WebSocket button delivery while preserving exact-once recovery.

## v0.8.94 deCONZ settings naming and direct UI link

- Renamed the visible Phoscon settings to **deCONZ** while preserving internal compatibility identifiers.
- Added a safe direct link to the configured deCONZ web interface.

## Compatibility

- Existing weekday schedules created with v0.8.96 remain compatible.
- Existing automations without schedule preferences still run on all seven days.
- No database migration is required.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.

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
