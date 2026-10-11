# SALTA v0.8.109

SALTA v0.8.109 reorganizes automation creation and editing into a dedicated full-width internal editor page. The automation overview is now focused on existing rules, while **New automation** and **Edit** open a separate workflow editor with substantially more room for triggers, conditions and ordered action/Wait sequences.

## v0.8.109 dedicated automation editor

- Removed the automation form from the narrow right-hand side panel of the rule overview.
- Added a clear **New automation** button to the Automations page.
- Creating a new rule now opens the dedicated internal `#automation-editor` SPA page.
- Editing an existing rule opens the same dedicated editor page with the current rule loaded.
- The **Automations** navigation item remains active while the editor page is open, so the editor still feels like part of the same SALTA section.
- Added explicit **Back to overview** / cancel navigation.
- After a successful save, SALTA returns automatically to the automation overview.
- The editor uses a much wider content area instead of the previous narrow side column.

## Clearer workflow structure

The editor is now visually separated into distinct sections:

1. **Basics** — name, room and enabled state.
2. **Execution days** — optional weekday/weekend restriction.
3. **When** — device/event or daily time trigger plus optional OR triggers.
4. **Only if** — optional AND-linked conditions.
5. **Then** — the ordered action sequence.

The **Then** section now presents the first target action explicitly as **Step 1**, matching the numbered sequence used by later actions and Wait steps. This makes flows such as the following easier to read while editing:

`Light On → Wait 30 s → Cover Close → Wait 5 s → Light Off`

The sequence controls are renamed and emphasized as **Next action** and **Insert wait**. Existing move-up, move-down and remove controls remain available for later sequence steps.

## Compatibility

- The automation REST API is unchanged from v0.8.108.
- The ordered sequence persistence format is unchanged from v0.8.108.
- Existing rules open directly in the new editor without a manual conversion.
- Existing ordered action/Wait sequences remain fully compatible.
- Existing configuration/disaster-recovery backups remain compatible.
- No database schema migration is introduced by v0.8.109.
- No `ALTER TABLE` statement or manual SQL migration is required.

## v0.8.108 ordered automation sequences carried forward

- Automations support up to eight ordered **Then** steps.
- Later sequence steps can be normal actions or explicit **Wait** steps from `1` to `86400` seconds.
- The same target can appear multiple times in one sequence.
- Wait steps execute asynchronously and do not block unrelated automations.
- `On for seconds` remains available as a separate native timed-device action where supported.
- Ordered sequences remain persisted in the additive `automation_sequence_steps` table.
- Backup/restore preserves the complete ordered sequence.
- Wait start/completion and completed action steps remain available in the system log.

## HomeKit system controls carried forward

- **Winter** remains the bidirectional HomeKit switch for SALTA Summer/Winter heating mode.
  - On = Winter.
  - Off = Summer.
- **Urlaub** remains the bidirectional HomeKit switch for SALTA vacation mode.
- Existing HomeKit pairing state is unaffected by this release.

## HomeMatic thermostat guard carried forward

- The hourly Winter guard only corrects thermostats explicitly reported as `AUTO` back to manual/Handbetrieb.
- Thermostats already in manual, OFF, Boost, Party or an unknown state are not rewritten by the Winter guard.
- OpenCCU `VirtualDevices` heating groups remain excluded from global climate-mode commands.
- Summer continues to enforce OFF for known non-OFF physical thermostat states.

## Roadmap

SALTA remains on the deterministic local-first roadmap:

- **v0.8.x — automation engine and workflow editor**
- **v0.9.x — advanced automation, diagnostics and system orchestration**
- **v1.0.0 — first stable release**

There is no planned LLM dependency for core SALTA operation.

## Dependencies and deployment compatibility

- No npm dependency is added or changed by v0.8.109.
- No new mandatory environment variable is introduced.
- No deployment-topology change is introduced.
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
