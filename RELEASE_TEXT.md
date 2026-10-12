# SALTA v0.8.121

SALTA v0.8.121 fixes the OpenCCU thermostat wire type used for floating-point commands.

## Changes

- Added a dedicated OpenCCU thermostat controller for `setTargetTemperature` and `setThermostatMode` commands.
- The automation engine remains fully generic: every configured workflow step continues to provide its own `deviceId`, action and value, and the device command router forwards the command without hard-coded thermostat IDs, rooms, groups or temperatures.
- OpenCCU thermostat commands are now routed by technical source/type/capability to the isolated thermostat controller. Unrelated OpenCCU commands continue to use the normal OpenCCU adapter path.
- Target-temperature handling no longer reads or interprets SALTA's global Summer/Winter mode. Workflow conditions decide whether an automation is allowed to run; the thermostat controller only executes the requested device capability.
- The thermostat controller reads the selected device's live OpenCCU `VALUES` state before command planning and reads the same channel back after the write.
- The existing metadata-driven thermostat planner is now applied directly to the live state. For a classic `BidCos-RF` thermostat reported as OFF, a requested target above the minimum produces one native `MANU_MODE=<requested temperature>` write instead of the v0.8.119 `MANU_MODE` plus `SET_TEMPERATURE` double write.
- A classic BidCos thermostat already in Manual or Auto continues to receive only its native target-temperature datapoint, normally `SET_TEMPERATURE`.
- HmIP thermostat behavior remains metadata-driven and does not inherit classic BidCos command semantics.
- Readback verification is bounded and verifies the target temperature and, when the selected technical plan changes the operating mode, the resulting operating mode.
- The SALTA registry is updated only from verified live OpenCCU readback for the isolated thermostat path.
- Thermostat diagnostics record the exact selected device, workflow-requested value, live pre-command state, exact OpenCCU writes, expected state, readback state and verification attempts.
- Added a reusable OpenCCU control client with a stable authenticated session for isolated control/status operations and clean logout during shutdown.
- Added an OpenCCU Duty Cycle monitor using OpenCCU's `Interface.getDutyCycle` API.
- The overview status bar now adds a sixth `Duty Cycle` field before presence and displays the highest reported OpenCCU Duty Cycle value.
- Duty Cycle status follows OpenCCU's 70% warning and 90% alarm thresholds and refreshes once per minute without being coupled to the normal device overview refresh.
- Duty Cycle failures are logged only when the failure changes, with a recovery log when values become available again.

## Root Cause

The v0.8.119 production diagnostic showed that the Nachtabsenkung workflow selected exactly the four configured wall thermostats and preserved the configured value of 15 °C for every step. SALTA then sent `MANU_MODE=15` followed by `SET_TEMPERATURE=15` to each selected classic `HM-TC-IT-WM-W-EU`, but three live readback attempts still returned `4.5 / off` for every device.

The architectural problem was that the OpenCCU adapter had accumulated thermostat policy that did not belong to the adapter. A target-temperature request read the global SALTA climate mode, changed the planning state from OFF to Manual, added a separate mode write and then added the temperature write. This coupled a generic workflow action to global heating policy and produced a two-write sequence even though the classic BidCos target planner already knows how to leave the synthetic OFF state with the requested `MANU_MODE=<temperature>` action.

v0.8.120 restores the platform boundary: the workflow defines **what** device/action/value should run, the router selects the technical controller, and the thermostat controller determines only **how** that requested capability is executed on the selected device. No workflow device list, room, group, Night setback temperature or global Winter policy is hard-coded into the thermostat controller.

## Compatibility

- No database schema change or migration is required.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing automations require no editing.
- Per-action thermostat target values remain stored and executed independently.
- Existing PostgreSQL and SALTA runtime volumes remain compatible.
- Existing HomeKit pairing state remains compatible.
- Existing non-thermostat OpenCCU commands are unchanged.
- Classic BidCos and HmIP thermostat protocol differences remain metadata-driven.
- `VirtualDevices` are not substituted for workflow targets and are not part of the isolated thermostat action routing.
- The overview Duty Cycle field is read-only and does not change OpenCCU configuration or radio behavior.

## Tests

- Regression coverage verifies that a classic BidCos OFF target action uses the workflow-provided temperature in exactly one `MANU_MODE` write.
- Regression coverage verifies that a classic BidCos thermostat already in Manual receives only `SET_TEMPERATURE`.
- Regression coverage verifies that target-temperature execution has no global Summer/Winter policy dependency.
- Router coverage verifies that only configured OpenCCU thermostat capabilities use the isolated thermostat controller and unrelated commands remain on the normal adapter.
- Duty Cycle coverage verifies OpenCCU array and JSON-string response parsing, the sixth overview statistic and the 70%/90% thresholds.
- Existing classic BidCos, HmIP, automation, HomeKit, diagnostic, adapter and deployment regression coverage remains enabled.
- Release validator passed for SALTA v0.8.120.
- JavaScript syntax checks passed.
- TypeScript production build passed.
- Test symbol preflight passed for 96 test files.
- 96 of 96 test files passed.
- 549 of 549 tests passed.

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
