# SALTA v0.8.111

SALTA v0.8.111 fixes the TypeScript production-build regression found after v0.8.110 made the complete automation **Then** sequence canonical and fully editable. Runtime behavior is unchanged; the release corrects the compile-time narrowing of action and `wait` sequence variants.

## v0.8.111 TypeScript sequence fix

- Explicitly types cloned automation sequences as `AutomationSequenceStep[]`.
- Keeps normal target actions and `wait` steps as a proper discriminated union during `cloneInput()`.
- Fixes the invalid `AutomationTargetAction` type predicate reported by TypeScript in `src/automations.ts`.
- Removes redundant `action !== "wait"` comparisons in `src/server.ts` after `Array.find()` has already narrowed the result to a real action.
- Fixes all six TypeScript errors reported by the v0.8.110 CI build.
- Adds a release-validator contract for the corrected narrowing behavior.

## Validation

The exact functional source fix was validated through the normal GitHub CI quality gate with a complete dependency installation:

- `npm ci` passed.
- release validation passed.
- test-symbol preflight passed for 82 test files.
- `tsc -p tsconfig.json` passed.
- the complete Vitest suite passed: **82 test files / 513 tests**.

The validation-only draft PR was closed without merge after the successful run.

## v0.8.110 fully editable sequences carried forward

- Every **Then** step remains part of one canonical ordered sequence.
- Existing Step 1 can be moved or deleted like later steps.
- Action and Wait steps can be reordered across the complete sequence.
- Any action can be removed as long as at least one real action remains.
- Wait steps can be removed freely.
- Sequences beginning with a Wait step keep their exact order after save/reload.
- The optional canonical `sequence` API field remains compatible with the legacy primary/additional action fields.

## v0.8.109 dedicated editor carried forward

- Automation creation and editing remain on the dedicated full-width `#automation-editor` page.
- Basics, execution days, **When**, **Only if** and **Then** remain visually separated.

## v0.8.108 ordered sequences carried forward

- Up to eight ordered action/Wait steps are supported.
- Wait values remain restricted to whole seconds from `1` to `86400`.
- The same target device may appear multiple times in a sequence.
- Wait steps remain asynchronous and do not block unrelated automations.
- `On for seconds` remains available as a separate native timed action.
- Ordered sequences remain persisted in `automation_sequence_steps` and preserved by backup/restore.

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
- No `ALTER TABLE` statement or manual SQL migration is required.
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
