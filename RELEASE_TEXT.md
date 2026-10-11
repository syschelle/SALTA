# SALTA v0.8.110

SALTA v0.8.110 fixes editing of existing ordered automation sequences. In v0.8.109, the first **Then** action was still treated as a special legacy primary action while only later actions and Wait steps were fully movable/removable. v0.8.110 makes the complete stored sequence canonical in the editor and runtime.

## v0.8.110 fully editable existing automation sequences

- Every **Then** step is now rendered through the same sequence editor.
- Existing Step 1 can be moved down just like every other step.
- Existing later steps can be moved all the way to the top.
- Action steps and Wait steps can be reordered across the complete sequence.
- Any action can be deleted as long as at least one real action remains in the rule.
- Wait steps can be deleted freely.
- The remove control is disabled only for the final remaining action so an invalid wait-only automation cannot be created.
- Existing automations reopen with their exact stored order instead of reconstructing the sequence around a special primary action.
- Sequences that begin with a Wait step remain in that order after save/reload.

Example:

```text
Wait 10 s
→ Light On
→ Wait 30 s
→ Cover Close
→ Light Off
```

The sequence above now remains exactly in that order when the rule is edited again.

## Canonical sequence API compatibility

v0.8.110 adds an optional canonical `sequence` field to the automation API.

- The existing `actionDeviceId`, `action`, `actionValue` and `additionalActions` fields remain supported for compatibility.
- When `sequence` is supplied, SALTA uses it as the canonical ordered execution definition.
- SALTA derives the legacy primary-action fields from the first real action in the canonical sequence.
- Existing API clients using the v0.8.109 payload continue to work unchanged.
- The automation engine executes `sequence` directly when present.
- Database loading returns the exact order stored in `automation_sequence_steps`.

## Validation and safety

- A sequence remains limited to a maximum of eight steps.
- Wait values remain restricted to whole seconds from `1` to `86400`.
- A rule must contain at least one real action.
- Existing trigger/action cycle protection remains active.
- Existing asynchronous Wait behavior remains unchanged and unrelated automations continue to run while one sequence is waiting.

## v0.8.109 dedicated editor carried forward

- Automation creation and editing remain on the dedicated full-width `#automation-editor` page.
- Basics, execution days, **When**, **Only if** and **Then** remain visually separated.
- Existing rules and new rules use the same editor.
- Successful saves return to the automation overview.

## v0.8.108 ordered sequences carried forward

- Up to eight ordered action/Wait steps are supported.
- The same target device may appear multiple times.
- `On for seconds` remains available as a separate native timed action.
- Ordered sequences remain persisted in the additive `automation_sequence_steps` table.
- Backup/restore continues to preserve the complete sequence.

## HomeKit system controls carried forward

- **Winter** remains the bidirectional HomeKit switch for Summer/Winter heating mode.
- **Urlaub** remains the bidirectional HomeKit switch for vacation mode.
- Existing HomeKit pairing state is preserved.

## HomeMatic thermostat guard carried forward

- In Winter, the hourly guard only corrects thermostats explicitly reported as `AUTO` back to manual mode.
- Manual, OFF, Boost, Party and unknown states are not rewritten by the Winter guard.
- OpenCCU `VirtualDevices` heating groups remain excluded from global climate-mode commands.
- Summer continues to enforce OFF for known non-OFF physical thermostat states.

## Persistence and deployment compatibility

- No new database table is introduced.
- No `ALTER TABLE` statement is required.
- No manual SQL migration is required.
- Existing `automation_sequence_steps` data is reused directly.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL and SALTA runtime volumes remain compatible and must be preserved.
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
