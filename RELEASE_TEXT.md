# SALTA v0.8.116

SALTA v0.8.116 makes automation and OpenCCU diagnostics fully correlatable across a complete automation run.

## Changes

- Every automation execution receives a unique `executionId`.
- The same execution ID is written to start, wait, step, failure, skip, finish and final automation log entries.
- Automation-originated device commands carry the execution ID, automation ID/name, step number and total sequence length into adapter diagnostics.
- OpenCCU `OPENCCU_COMMAND_APPLIED` and `OPENCCU_COMMAND_FAILED` entries now contain that same context, so an exact `Interface.setValue` write can be assigned to the exact automation step that caused it.
- `AUTOMATION_EXECUTION_FINISHED` contains an ordered `results` array showing the outcome of every processed step.
- Diagnostic state fields are now explicitly named `localState...` / `localTargetState...` and include a local-state origin marker. These fields describe SALTA's local projected registry state and are not presented as physical OpenCCU readback.
- The System Log adds **Copy execution** on correlated automation start/finish entries. It exports all retained log entries with the same execution ID as one formatted JSON diagnostic payload, including automation and OpenCCU events.
- Clipboard export includes an HTTP-compatible fallback when the browser Clipboard API is unavailable.

## Root Cause

v0.8.115 logged the complete automation sequence and exact OpenCCU writes, but the events were independent. There was no shared run identifier between automation-step logs and adapter-level OpenCCU logs, so multiple entries from the same run could not be correlated unambiguously. In addition, fields named `stateAfter` / `targetStateAfter` represented SALTA's local projected state after an accepted command, not a fresh readback from the physical HomeMatic device. That naming could therefore make a stale local mode value look like an OpenCCU response.

v0.8.116 fixes the diagnostic model without changing thermostat command behavior.

## Compatibility

- No database schema change or migration is required.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing automations require no editing.
- Existing PostgreSQL and SALTA runtime volumes remain compatible.
- Existing HomeKit pairing state remains compatible.
- OpenCCU/HomeMatic thermostat command semantics from v0.8.115 are unchanged.

## Tests

- Release validator covers execution-ID propagation, execution-result diagnostics, OpenCCU command correlation and clipboard execution export.
- Automation diagnostics regression coverage verifies one execution ID across a four-step run and verifies adapter context on every generated command.
- OpenCCU diagnostics coverage verifies correlated command context and explicit local-state semantics.
- System-log frontend coverage verifies complete-run clipboard export and the Copy execution control.
- The complete GitHub Actions quality gate must pass before the release is tagged.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.
