# SALTA v0.8.98

SALTA v0.8.98 fixes the two remaining frontend Vitest regressions from the v0.8.96 weekday schedule UI. The production automation runtime and weekday scheduling logic are unchanged. Two isolated `vm` test sandboxes loaded the complete `public/automation-ui.js` source but mocked only `document.getElementById()`. Since the weekday UI now initializes through `document.querySelectorAll()`, those sandboxes failed before their actual assertions could run. They now provide the minimal empty `querySelectorAll()` DOM stub required by the current frontend module.

## v0.8.98 isolated frontend test sandbox fix

- Fixed the two failing `frontend-automations.test.ts` cases reported by the v0.8.97 GitHub CI run.
- Added `document.querySelectorAll: () => []` to the two intentionally minimal VM sandboxes that execute the complete automation frontend source without a browser DOM.
- The empty result accurately represents those tests: they exercise trigger-summary and virtual-target logic and do not create weekday checkbox elements.
- No production JavaScript, automation runtime, weekday evaluation, database schema, API contract, mandatory environment variable, dependency or deployment topology changed in v0.8.98.
- The existing tests now continue to act as regressions for loading `automation-ui.js` in the isolated sandbox while preserving their original behavioral assertions.

## v0.8.97 weekday API type-safety build fix

- Fixed the TypeScript build regression in the v0.8.96 weekday schedule API by preserving `executionDays` as the literal weekday union `1 | 2 | 3 | 4 | 5 | 6 | 7` instead of widening it to `number[]`.
- Added a typed API normalization boundary and regression coverage for the weekday schema.
- Runtime weekday scheduling behavior remained unchanged.

## v0.8.96 optional weekday and weekend automation schedules

- Added optional per-automation execution-day restrictions for Monday through Sunday.
- Existing automations continue to run on all seven days by default.
- Added the weekend convenience control and local-timezone day evaluation for device, event and time triggers.
- Added the additive `automation_schedule_preferences` table and backup/restore support without altering the existing `automations` table.

## v0.8.95 deCONZ reconnect button-event safety

- Added a recovery baseline after deCONZ/network interruptions so replayed button states do not trigger automations.
- Required genuinely new deCONZ `lastupdated` revisions for WebSocket button delivery while preserving exact-once recovery.

## Compatibility

- v0.8.98 changes test and release metadata only; production runtime behavior is unchanged from v0.8.97.
- Existing weekday schedules created with v0.8.96 remain compatible.
- Existing automations without schedule preferences still run on all seven days.
- Existing deCONZ, OpenCCU, Shelly, Hue, HomeKit, Presence, Vacation mode and Heating mode behavior remains compatible.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- No manual database migration is required.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.

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
