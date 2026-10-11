# SALTA v0.8.108

SALTA v0.8.108 completes the planned v0.8.x automation-engine sequence foundation by adding ordered **Wait** steps between normal actions. Automations can now express deterministic flows such as `Light On → Wait 30 s → Cover Close → Wait 5 s → Light Off` while unrelated rules continue to execute normally.

## v0.8.108 ordered automation sequences

- Added explicit **Wait** steps to the **Then** sequence.
- Wait values are whole seconds from `1` to `86400`.
- Up to eight total sequence steps are supported per automation.
- The first sequence step remains an action; following steps can be actions or waits.
- The same target device may appear multiple times in one sequence, so a device can be switched on near the beginning and off again later.
- Additional steps can be reordered with move-up/move-down controls in the automation editor.
- The editor now provides separate **Add action** and **Add wait** controls.
- Waits are asynchronous and do not block unrelated automation rules.
- Conditions are evaluated when a sequence starts; they are not re-evaluated after every Wait step.
- Existing `On for seconds` remains available as a separate native timed-device action and is not replaced by general Wait steps.

## Persistence and restart behavior

- Added the additive `automation_sequence_steps` table as the canonical ordered sequence representation.
- Existing v0.8.x automation targets/system actions are migrated idempotently into the new table during normal database initialization.
- No legacy automation table is altered or dropped.
- Legacy target/action tables continue to receive a best-effort compatibility projection when sequences are saved.
- Configuration/disaster-recovery backup now includes `automation_sequence_steps`.
- Existing format-v1 backup files without the new table remain accepted and are upgraded into sequence storage during restore.
- The automation trigger timestamp is persisted after the first successful action, before a potentially long Wait, reducing the risk of replaying a daily time rule solely because SALTA restarted later during the sequence.
- Stopping the automation engine invalidates in-flight sequence execution, and Wait timers do not keep the Node.js process alive during shutdown.

## Validation and safety

- Existing automation cycle detection remains active for device action edges; Wait steps do not create graph edges.
- Existing trigger/target safety rules remain active.
- The deliberate virtual-switch self-reset exception remains supported and its reset action still runs after the other configured sequence steps.
- Wait start/completion and completed action steps are written to the SALTA system log for easier diagnostics.
- A failed target command is logged and later configured sequence steps continue, matching the existing multi-action behavior.
- Added regression coverage for ordered action/wait execution, repeated targets, concurrent unrelated rules, Wait validation, API persistence and frontend sequence editing.

## Roadmap update

The planned v0.8.x automation-engine delay/sequence foundation is now implemented. The previous LLM/assistant direction is removed from the roadmap. The next minor line is defined as:

**v0.9.x — advanced automation, diagnostics and system orchestration**

The focus remains deterministic local automation rather than an LLM dependency.

## v0.8.107 HomeKit system switches carried forward

- The built-in **Winter** HomeKit switch remains bidirectional: On = Winter, Off = Summer.
- The built-in **Urlaub** HomeKit switch remains bidirectional with SALTA vacation mode.
- Both switches use the canonical SALTA managers and preserve the existing HomeKit pairing state.

## v0.8.105 HomeMatic Duty Cycle reduction carried forward

- The hourly Winter guard only corrects thermostats explicitly reported as `AUTO` back to manual/Handbetrieb.
- Thermostats already in manual, OFF, Boost, Party or an unknown state are not rewritten by the Winter guard.
- OpenCCU `VirtualDevices` heating groups remain excluded from global climate-mode commands.
- Summer continues to enforce OFF for known non-OFF physical thermostat states.

## v0.8.104 OpenCCU thermostat handling carried forward

- Classic HomeMatic/BidCos thermostats continue to use their native `AUTO_MODE` / `MANU_MODE` command path.
- HmIP-specific mode datapoint handling remains isolated to HmIP device families.

## v0.8.103 security refresh carried forward

- Fastify remains at `5.12.5`.
- Patched `fast-uri` paths remain at `3.1.8` and `4.2.2`.
- Vitest and `@vitest/mocker` remain at `4.1.11`.
- `source-map-js` remains at `1.2.2`.
- The vulnerable `tinypool@1.1.1` path remains absent from the resolved dependency tree.

## Persistence and deployment compatibility

- One new additive table, `automation_sequence_steps`, is created automatically.
- No `ALTER TABLE` statement or manual SQL migration is required.
- No npm dependency is added or changed by v0.8.108.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL and SALTA runtime volumes remain compatible and must be preserved.
- Existing HomeKit pairing state is unaffected.

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
