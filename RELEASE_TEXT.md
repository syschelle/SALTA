# SALTA v0.8.96

SALTA v0.8.96 adds optional execution-day restrictions to automations. Existing rules continue to run every day by default, while individual automations can now be limited to selected weekdays and optionally to weekends. The restriction is evaluated in the configured SALTA timezone at the moment the trigger is received, so device events, button events and daily time triggers all follow the same local-day rule.

## v0.8.96 optional weekday and weekend automation schedules

- Added optional **execution days** to every automation without changing the existing `automations` table.
- Existing automations default to **all seven days** and therefore keep their previous behavior automatically.
- Added weekday selection for **Monday through Sunday** in the automation editor.
- Added a dedicated **Run on weekends / Am Wochenende ausführen** control that toggles Saturday and Sunday together while still allowing individual day selection.
- A restricted automation is skipped when its trigger arrives on a non-selected local day.
- Day evaluation uses the configured SALTA timezone (`TZ`) and is performed when the trigger is queued, preventing a delayed execution from crossing midnight and being evaluated against the wrong day.
- The same execution-day gate applies to device state transitions, deCONZ/OpenCCU button events and daily time triggers.
- Automation cards show the selected execution days when a rule is restricted; unrestricted rules remain visually compact.
- Daily time-trigger helper text no longer implies unconditional daily execution when a weekday restriction is active.
- Added the additive `automation_schedule_preferences` table with one boolean per weekday. No `ALTER TABLE` is used.
- Configuration/disaster-recovery backups preserve the new schedule table, while older signed format-v1 backups without it remain compatible and restore as all-days schedules.
- Added API validation, frontend validation and regression coverage for local weekday calculation, weekday-only execution, weekend-only execution, persistence and UI payload handling.
- Added German/English translations for the new execution-day controls and summaries.
- No manual database migration, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.95 deCONZ reconnect button-event safety

- Prevented deCONZ button-state replays after network, router, VM or gateway connectivity interruptions from being interpreted as fresh physical button presses.
- Added a recovery baseline after connectivity loss and required genuinely new deCONZ `lastupdated` revisions for WebSocket button delivery.
- Added reconnect/recovery diagnostics while preserving the v0.8.91 exact-once button-event deduplication.

## v0.8.94 deCONZ settings naming and direct UI link

- Renamed the visible Phoscon integration settings to **deCONZ** while preserving internal compatibility identifiers.
- Added a safe direct link to the configured local deCONZ web interface in a new browser tab/window.

## v0.8.93 bounded command-history retention

- Added automatic retention for the existing `commands` table.
- Commands older than **90 days** are removed and only the **10,000 newest records** are retained as a hard upper bound.
- Retention runs at startup and during continued operation without altering the existing table.

## Compatibility

- Existing automations without an `automation_schedule_preferences` row run on all seven days.
- Existing device, event and time triggers remain unchanged.
- Existing deCONZ, OpenCCU, Shelly, Hue, HomeKit, Presence, Vacation mode and Heating mode behavior remains compatible.
- The new schedule persistence is additive and created idempotently during normal schema initialization.
- Existing configuration backups remain compatible; missing execution-day data defaults to all days.
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
