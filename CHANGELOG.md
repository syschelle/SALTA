# Changelog

## 0.8.119 - Live OpenCCU thermostat preflight and verified readback

- Changed OpenCCU thermostat target-temperature commands to read the live channel `VALUES` state immediately before command planning instead of trusting the SALTA registry snapshot.
- In Winter mode, a thermostat confirmed as OFF is restored to Manual before the requested target temperature is written.
- For classic BidCos/HomeMatic thermostats such as `HM-TC-IT-WM-W-EU`, OFF recovery uses the ordered native writes `MANU_MODE=<requested temperature>` followed by `SET_TEMPERATURE=<requested temperature>`.
- Thermostats already confirmed as Manual remain on the target-only path; Summer mode does not perform the Winter OFF-to-Manual recovery.
- Added bounded post-command OpenCCU readback and require the requested target temperature, plus Manual mode when recovery was required, before reporting command success.
- Registry state after a thermostat target command now comes from verified OpenCCU readback instead of an optimistic local projection.
- Extended OpenCCU command diagnostics with live preflight state, exact ordered writes, readback state, readback attempts, Winter recovery decision and verification result.
- Added regression coverage for Winter OFF recovery, already-Manual target-only behavior and Summer isolation.
- No database schema, dependency, mandatory environment-variable, HomeKit pairing or deployment-topology change is required.

## 0.8.118 - Classic BidCos OFF recovery and diagnostic export hardening

- Fixed classic `BidCos-RF` target-temperature actions while SALTA reports the thermostat as `off`: requests above the minimum now use native `MANU_MODE=<temperature>` so the physical thermostat leaves OFF and enters manual operation at the requested setpoint.
- Kept the exception deliberately narrow. Classic Manual/Auto states continue to use the discovered target-temperature datapoint, and HmIP continues to use its own target-temperature datapoint without inheriting the BidCos rule.
- Kept minimum-temperature requests while already OFF on the normal target-temperature datapoint.
- Upgraded the sanitized diagnostic export to format version 2.
- Preserved `Date` values as ISO timestamps instead of serializing them as empty objects.
- Removed MAC, IP and host identifiers from presence devices in the general diagnostic device registry while retaining non-network diagnostic state.
- Preserved OpenCCU/HomeMatic channel and datapoint metadata required for support analysis.
- Fixed the release-version helper so repeated active GHCR image references in `GIT_COMMANDS.md` no longer block a valid version bump.
- Added focused regression coverage for BidCos OFF recovery, Manual/Auto isolation, HmIP isolation, presence redaction and diagnostic date preservation.
- No database schema, dependency, mandatory environment-variable, HomeKit pairing or deployment-topology change is required.

## 0.8.117 - Sanitized full-system diagnostic export

- Added a one-click sanitized diagnostic export to the System Log page.
- The export combines runtime settings, adapter status, rooms, automations, current device registry state and the retained system log into one JSON file for support analysis.
- OpenCCU device/channel metadata and current thermostat state are preserved so HomeMatic command paths can be reconstructed without a separate configuration dump.
- Passwords, API/application/user keys, tokens, sessions, HomeKit PIN/setup data, credential usernames and encrypted secret fields are excluded. Presence MAC/IP addresses are intentionally omitted.
- Added a final known-secret guard which aborts the export if any readable configured plaintext secret is found in the generated payload.
- No thermostat command behavior is changed by this release.
- GitHub CI now runs directly on `work/**` branches so validation does not require temporary/test pull requests.


## v0.8.116

- Added a unique `executionId` to every automation run and propagate it through all automation execution log entries.
- Automation-originated device commands now carry the execution ID, automation ID/name, step number and sequence length into the adapter diagnostic context.
- OpenCCU command logs now include the originating automation execution context, allowing every `Interface.setValue` call to be matched to the exact automation step that caused it.
- `AUTOMATION_EXECUTION_FINISHED` now contains an explicit ordered per-step result list with success, skipped, failed and completed-wait outcomes.
- Renamed diagnostic state fields to `localState...` / `localTargetState...` and mark them explicitly as SALTA-local state rather than physical device readback. This prevents local projected thermostat state from being mistaken for a value read back from OpenCCU.
- Added **Copy execution** to correlated automation execution entries in the System Log. The clipboard export collects all retained automation and OpenCCU log entries with the same execution ID into one JSON diagnostic payload.
- Thermostat command behavior is intentionally unchanged in this diagnostic release.
- No database schema, dependency, mandatory environment-variable, HomeKit pairing, or deployment-topology change is required.

## v0.8.115

- Added clipboard export for individual automation workflows and for all workflows from the automation overview.
- Workflow diagnostics include the complete canonical trigger/condition/step configuration plus resolved device names, source/type/model, reachability, current state, capabilities and a strictly allow-listed OpenCCU metadata subset useful for troubleshooting.
- Clipboard export deliberately excludes connection hosts, passwords, tokens and other credential material and includes an HTTP-compatible fallback when the modern Clipboard API is unavailable.
- Automation execution logging now records the complete loaded sequence before execution and a final execution summary even when every action fails or is skipped.
- Existing per-step automation logs now include resolved target name/source/model and state before/after where available.
- OpenCCU command logging now records the exact `Interface.setValue` writes SALTA attempted/applied, including interface, channel address, value key, JSON-RPC value type and value, without credentials.
- System-log retention remains bounded at 100 entries / 30 days; the diagnostic improvement increases detail per relevant event rather than removing the existing retention guard.
- No database schema, dependency, mandatory environment-variable, HomeKit pairing, or deployment-topology change is required.

## v0.8.114

- Fixed OpenCCU thermostat automation actions so `setTargetTemperature` now changes only the native target-temperature datapoint and never writes an operating-mode datapoint.
- Reverted the incorrect v0.8.112 coupling that redirected classic BidCos/HomeMatic target-temperature writes through `MANU_MODE=<temperature>` while the thermostat was reported as Manual or OFF.
- Classic HomeMatic now always uses its discovered target datapoint (normally `SET_TEMPERATURE`) for a temperature-only action; HmIP continues to use its discovered target datapoint (normally `SET_POINT_TEMPERATURE`).
- `MANU_MODE`, `AUTO_MODE`, `CONTROL_MODE`, and other thermostat-mode datapoints are reserved for explicit thermostat/heating-mode commands only.
- A manual automation run therefore has exactly the same thermostat command semantics as a scheduled run: bypassing trigger/conditions does not alter how the action itself is executed.
- Added regression coverage for classic HomeMatic Manual, OFF and AUTO states plus HmIP, asserting that temperature-only actions never emit a mode write.
- No database schema, dependency, mandatory environment-variable, HomeKit pairing, or deployment-topology change is required.

## v0.8.113

- Added a **Run now** control to every automation card for deliberate manual execution of its configured Then sequence.
- Manual execution bypasses the configured **When** trigger, execution-day schedule and all **Only if** conditions; it also works while the rule itself is disabled, making it suitable for testing before activation.
- Manual runs reuse the existing serialized automation queue, ordered action/Wait sequence execution, capability checks, logging and last-trigger timestamp handling instead of introducing a second action runtime.
- Added a **Duplicate** control that copies room assignment, trigger, execution days, conditions and the complete ordered action/Wait sequence.
- Duplicated automations are created disabled and receive a locale-aware `(Kopie)` / `(Copy)` suffix so an exact copy cannot begin firing in parallel before it is reviewed.
- Added the rate-limited `POST /api/automations/:id/trigger` endpoint; it accepts the manual run immediately while long Wait sequences continue through the existing asynchronous automation runtime.
- Added engine, frontend, API-contract, release-validator and rate-limit regression coverage for manual execution and duplication.
- Fixed the release version helper so future bumps follow the current `GIT_COMMANDS.md` version/image verification instead of obsolete validator-contract lines.
- No database schema, dependency, mandatory environment-variable or deployment-topology change is required.

## v0.8.112

- Fixed classic HomeMatic thermostat night-setback writes so a target-temperature action no longer relies only on `SET_TEMPERATURE` while the device is in MANU/OFF semantics.
- For classic BidCos/HomeMatic thermostats in `manual` or `off`, SALTA now writes the requested target directly through native `MANU_MODE=<temperature>`, which atomically restores/keeps manual mode and applies the requested setpoint.
- A 15.0 °C setback therefore sends `MANU_MODE=15.0` instead of leaving the device in the HomeMatic OFF representation.
- AUTO mode remains untouched by ordinary target-temperature writes; SALTA continues to use `SET_TEMPERATURE` there so an explicit Auto state is not silently overridden by a setpoint-only action.
- HmIP devices remain on their existing datapoint path and are explicitly excluded from the classic `MANU_MODE` routing, even if stale metadata contains a manual-mode field.
- Added regression coverage for classic manual, classic OFF, classic AUTO and HmIP target-temperature writes.
- The exact functional fix passed the complete GitHub CI quality gate with a production TypeScript build and the full Vitest suite: 83 test files / 517 tests; dynamic CodeQL PR analysis also passed.
- Carries forward the v0.8.111 TypeScript sequence fix and the v0.8.110 fully editable automation sequence editor.
- No database schema, dependency, mandatory environment-variable or deployment-topology change is required.

## v0.8.111

- Fixed the TypeScript build regression introduced by the canonical automation sequence handling in v0.8.110.
- Explicitly types cloned automation sequences as `AutomationSequenceStep[]`, keeping action and `wait` variants as a valid discriminated union during `cloneInput()`.
- Removes redundant `action !== "wait"` checks after TypeScript has already narrowed the first real sequence action in the API normalization path.
- Preserves all v0.8.110 runtime behavior: existing Then steps remain fully reorderable/removable, Wait-first sequences remain stable, and legacy automation fields remain compatible.
- Added a release-validator contract for the corrected TypeScript narrowing so the compile-safe sequence handling cannot silently regress.
- The exact functional fix passed the complete GitHub CI quality gate with a real dependency install, TypeScript production build, and the full Vitest suite: 82 test files / 513 tests.
- No database schema, dependency, environment-variable or deployment-topology change is required.

## v0.8.110

- Fixed editing of existing automation **Then** sequences so every stored action and Wait step is loaded as one canonical ordered sequence.
- Existing Step 1 is no longer a special immovable/non-removable primary editor row; all sequence steps now use the same edit, move-up, move-down and remove controls.
- Allows reordering across the complete sequence, including moving an existing first action below later actions or Wait steps.
- Allows deleting any action step as long as at least one real action remains; Wait steps can be deleted freely.
- Added an optional canonical `sequence` field to the automation API while keeping the legacy primary-action/additional-action fields for compatibility.
- Preserves exact stored order from `automation_sequence_steps`, including sequences that begin with a Wait step.
- Added runtime/API/frontend/database regression coverage for full-sequence preservation, leading Wait steps and action-required validation.
- No database schema change, npm dependency, mandatory environment variable or deployment-topology change is introduced.

## v0.8.109

- Moved automation creation and editing out of the narrow overview side panel into a dedicated full-width internal SPA page.
- Added a clear **New automation** action to the automation overview; editing an existing rule opens the same dedicated editor and keeps the Automations navigation item active.
- Reworked the editor hierarchy into separate Basics, execution-day, **When**, **Only if** and **Then** sections so triggers, conditions and actions no longer compete for space in one narrow column.
- Reworked the **Then** sequence UI so the first action is rendered as explicit **Step 1**, matching later actions and Wait steps.
- Renamed the sequence controls to **Next action** and **Insert wait** and made them visually prominent in the full-width sequence editor.
- Added a dedicated save bar with clear cancel/back navigation; successful saves return to the automation overview.
- Kept the v0.8.108 automation API, database sequence format and runtime semantics unchanged, so existing rules and backups remain compatible.
- Added frontend/release-validator regression coverage for the dedicated automation editor route, navigation binding and full-width layout.
- Updated German/English UI translations and documentation for the new editor workflow.
- No database schema change, npm dependency, mandatory environment variable or deployment-topology change is introduced.

## v0.8.108

- Added ordered automation action sequences with explicit **Wait** steps between device/system actions.
- Wait steps accept whole seconds from 1 to 86400 and execute asynchronously, so unrelated automation rules continue to run while a sequence is waiting.
- The same target device can appear multiple times in one sequence, enabling flows such as `Light On → Wait 30 s → Cover Close → Wait 5 s → Light Off`.
- Added move-up/move-down controls for additional sequence steps and dedicated **Add action** / **Add wait** controls in the automation editor.
- Kept the existing `On for seconds` action unchanged for devices such as Shelly that support a native timed command; general Wait steps are a separate orchestration primitive.
- Added additive `automation_sequence_steps` persistence with action/wait step typing, repeated-target support and an idempotent migration from existing v0.8.x automation target/system-action rows. No legacy table is altered.
- Configuration/disaster-recovery backup now preserves sequence steps and automatically upgrades older format-v1 backups that do not contain the new table.
- Sequence execution logs wait start/completion and individual completed steps; the automation trigger timestamp is persisted after the first successful action so a long sequence is not replayed merely because SALTA restarts later.
- Stopping the automation engine invalidates in-flight sequences, and wait timers do not keep the Node.js process alive during shutdown.
- Existing cycle protection and the safe virtual-switch self-reset behavior are retained; the self-reset remains the final device action after configured sequence steps.
- Updated the roadmap: v0.8.x now completes the automation-engine delay/sequence foundation, while v0.9.x is defined as **advanced automation, diagnostics and system orchestration** without an LLM dependency.
- No npm dependency, mandatory environment variable or deployment-topology change is introduced.

## v0.8.107

- Renamed the built-in HomeKit heating-mode switch from **Wintermodus** to the shorter **Winter** label while preserving On = Winter and Off = Summer.
- Added the built-in HomeKit switch **Urlaub** for SALTA vacation mode. On enables vacation mode and Off disables it through the existing `VacationModeManager`.
- Vacation-mode changes made from SALTA are mirrored back to HomeKit through the canonical `system:vacation-mode` state; HomeKit writes use the same central manager, so no parallel state is introduced.
- Upgraded the existing hidden `system:vacation-mode` device idempotently to a HomeKit-capable switch with `vacationActive` and `on` synchronized to the same boolean value.
- Both hidden system switches are explicitly allowed through the HomeKit publication filter while remaining hidden from normal SALTA device lists.
- Existing HomeKit pairing state is preserved; no HomeKit reset or re-pair is required.
- Added regression and release-validator coverage for the Winter/Urlaub HomeKit labels, hidden system-device publication and bidirectional vacation-mode mapping.
- No new table, `ALTER TABLE`, manual SQL migration, dependency or mandatory environment variable is required.

## v0.8.106

- Added the built-in HomeKit switch **Wintermodus** for SALTA's global Summer/Winter heating mode.
- The HomeKit switch is **On** while Winter mode is active and **Off** while Summer mode is active.
- Switching **Wintermodus** on in Apple Home applies SALTA Winter mode through the existing central climate manager; switching it off applies Summer mode.
- Changes made through the SALTA UI, REST API or automations update the same internal system state and are reflected back into the HomeKit switch.
- Reuses the existing `system:climate-mode` system device instead of introducing a second independent heating-mode state.
- The internal climate-mode system device remains hidden from normal SALTA device lists but is explicitly allowed through the HomeKit bridge publication filter.
- Database initialization upgrades the existing climate-mode system record idempotently to a HomeKit-capable switch named `Wintermodus`; no new table, `ALTER TABLE`, manual SQL migration or HomeKit re-pairing is required.
- Carries forward the v0.8.105 conservative HomeMatic thermostat guard and Duty Cycle reduction unchanged.
- No dependency change, new mandatory environment variable or deployment-topology change is required.

## v0.8.105

- Reduced HomeMatic thermostat radio traffic from the global Summer/Winter heating-mode routines.
- The hourly Winter guard now corrects only thermostats that OpenCCU explicitly reports as `AUTO`; thermostats already in `manual`, `OFF`, Boost, Party or an unknown mode are left untouched.
- The hourly Summer guard continues to enforce `OFF`, but only for known non-OFF thermostat modes; ambiguous/unknown states are ignored instead of being rewritten repeatedly.
- Explicit Summer/Winter application now skips physical thermostats that are already in the requested mode.
- OpenCCU `VirtualDevices` heating groups are excluded from global climate-mode commands so SALTA does not command a virtual group and its physical members in parallel.
- The hourly interval remains one hour so accidentally switching a thermostat back to Auto is still repaired automatically during Winter mode.
- Added regression and release-validator coverage for conservative Winter correction, Summer OFF enforcement, virtual-group exclusion and duplicate-write avoidance.
- Carries forward the v0.8.104 OpenCCU thermostat synchronization fix and v0.8.103 dependency-security refresh.
- No database schema change, manual migration, dependency change, new mandatory environment variable or deployment-topology change is required.

## v0.8.104

- Fixed OpenCCU/Homematic IP thermostat mode synchronization so established HmIP thermostat families read the active mode from `SET_POINT_MODE` but send mode changes through `CONTROL_MODE`.
- Prevented SALTA from treating the HmIP status datapoint as the command endpoint, which could make OpenCCU and SALTA disagree and could cause the hourly heating-mode guard to re-apply an incorrect mode.
- Winter mode continues to enforce `manual`/Handbetrieb, but now preserves an already valid manual target temperature such as 20 °C instead of replacing it while merely correcting the operating mode.
- Summer mode continues to enforce `off`; devices without a dedicated off mode still use manual mode plus the reported minimum/frost-protection temperature.
- Added an explicit R4M-family exception because newer HmIP R4M thermostats reverse the mode datapoint direction (`CONTROL_MODE` for status and `SET_POINT_MODE` for commands).
- Normalizes persisted/pre-v0.8.104 HmIP mode metadata at command time so the fix applies immediately without requiring a prior successful OpenCCU registry refresh.
- Added regression coverage for HmIP-WTH-2 mode/status separation, preservation of a 20 °C manual setpoint, OFF handling and the R4M exception.
- Carries forward the v0.8.103 dependency-security refresh and the v0.8.102 hourly Summer/Winter thermostat guard unchanged.
- No database schema change, manual migration, dependency change, new mandatory environment variable or deployment-topology change is required.

## v0.8.103

- Security-only dependency refresh for the GitHub dependency alerts reported against the v0.8.102 lockfile; no SALTA runtime feature or database behavior is changed.
- Updated Fastify to `5.12.5` and locked `fast-uri` to patched `3.1.8` / `4.2.2` paths.
- Updated Vitest and `@vitest/mocker` to `4.1.11`; the old vulnerable `tinypool@1.1.1` dependency disappears from the resolved tree.
- Updated `source-map-js` to `1.2.2` and retained the existing `find-my-way@9.7.0` and `@homebridge/dbus-native@0.7.7` security/reproducibility overrides.
- Added release-validator and regression coverage that prevents Fastify, fast-uri, Vitest, Tinypool or source-map-js from falling below the patched security floors.
- The refreshed lockfile was generated from the public npm registry and verified with `npm ci` plus the complete `npm run check` in GitHub Actions before packaging.
- Carries forward v0.8.102 hourly thermostat-mode enforcement, v0.8.101 fixed-IP presence recovery, v0.8.100 delayed contact triggers and v0.8.99 native timed Shelly actions unchanged.
- No database schema change, manual migration, new mandatory environment variable or deployment-topology change is required.

## v0.8.102

- Winter heating mode now always sets every compatible thermostat to **manual/Handbetrieb**; the previous configurable automatic Winter mode has been removed from the heating-mode UI.
- Summer heating mode continues to set every compatible thermostat to **off/Aus**.
- Replaced the former 12-hour Summer-only thermostat guard with an hourly global heating-mode guard.
- The hourly guard repairs thermostat mode drift in both directions: `off` in Summer and `manual` in Winter.
- Existing persisted `winter_mode='auto'` values are normalized idempotently to `manual` during database initialization; no schema change or manual migration is required.
- Added regression coverage for hourly cadence, Winter manual enforcement, Summer off enforcement, stale automatic settings and rejection of new automatic Winter-mode configuration.
- Carries forward v0.8.101 fixed-IP FRITZ!Box presence recovery, v0.8.100 delayed contact triggers and v0.8.99 native timed Shelly actions unchanged.
- No new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.101

- Added a fixed IP address to FRITZ!Box Wi-Fi presence targets alongside the existing MAC address.
- Presence reconciliation still checks the configured MAC first, then uses the configured fixed IP as a recovery identity if that MAC is inactive or resolves to a different address.
- Added AVM `X_AVM-DE_GetSpecificHostEntyByIP` support plus a rights-free `GetGenericHostEntry` enumeration fallback for FRITZ!OS versions or user permissions where the AVM-specific IP action is unavailable.
- If the fixed IP resolves to a different valid MAC address, SALTA updates the stored presence MAC automatically so iPhone/iPad private Wi-Fi MAC changes do not permanently break presence detection.
- Added the fixed-IP field, configured/observed IP display and an explicit iPhone/iPad private-MAC warning to the Presence configuration UI.
- Existing presence targets remain compatible and continue to work MAC-only until a fixed IP is configured.
- Added the additive `presence_target_network` table and configuration/disaster-recovery backup support without modifying `presence_targets`, using `ALTER TABLE`, or requiring manual migration.
- Added regression coverage for IP validation, AVM IP lookup, generic-host fallback, automatic MAC replacement, UI persistence and backup/schema compatibility.
- Carries forward the v0.8.100 **Closed for 10 seconds** contact trigger and the v0.8.99 Shelly **On for seconds** action unchanged.
- No new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.100

- Added a contact-sensor automation trigger option **Closed for 10 seconds** for window and door contacts.
- The timer starts only on the transition to the closed state and fires only if the same contact remains closed for the full 10 seconds.
- Reopening the contact before the 10-second interval expires cancels the pending trigger, preventing short closures or contact bounce from executing the automation.
- The delayed trigger is restricted to `contactSensor` devices using the canonical `open` state and the closed (`false`) value.
- Existing immediate **Open** and **Closed** triggers remain unchanged.
- The delayed state is persisted through the existing automation trigger state key, so no database schema change, `ALTER TABLE`, manual migration or new dependency is required.
- Added automation-engine, frontend and release-validator regression coverage for the 10-second contact trigger and its cancellation behavior.
- Carries forward the v0.8.99 Shelly **On for seconds** action and the v0.8.98/v0.8.97/v0.8.96 automation test and scheduling improvements unchanged.
- No new mandatory environment variable or deployment-topology change is required.

## v0.8.99

- Added the Shelly automation action **On for seconds** with a freely configurable whole-number duration from 1 to 86400 seconds.
- Uses the Shelly-native one-shot timer: Gen1 sends `turn=on&timer=<seconds>` and Gen2/Gen3/Gen4 RPC devices send `Switch.Set` with `toggle_after`.
- Restricts the action to Shelly switch/relay components and validates target type and duration in the API and automation engine.
- Added additive `automation_timed_actions` persistence plus configuration backup/restore compatibility without altering the existing automation target table.
- Added regression coverage for frontend visibility, automation execution and both Shelly protocol generations.
- Carries forward the v0.8.98 frontend test fix and the v0.8.97/v0.8.96 weekday scheduling improvements.
- No manual database migration, new mandatory environment variable or new npm dependency is required.

## v0.8.98

- Fixed the two isolated automation frontend VM tests that failed after the weekday UI introduced `document.querySelectorAll()`.
- Added the minimal `querySelectorAll: () => []` DOM stub to both affected test sandboxes; production automation code remains unchanged.
- Carries forward the v0.8.97 weekday API type fix and v0.8.96 weekday/weekend scheduling feature unchanged.
- No database schema, runtime behavior, environment variable, dependency or deployment-topology change is required.

## v0.8.97

- Fixed the v0.8.96 TypeScript build regression where Zod inferred automation `executionDays` as `number[]` while `AutomationInput` requires `AutomationWeekday[]`.
- Changed the API execution-day element schema to the literal union `1 | 2 | 3 | 4 | 5 | 6 | 7`, preserving the validated runtime range while keeping the inferred type exact.
- Added an explicit `AutomationInput` return type to the request normalization boundary.
- Added regression and release-validator coverage preventing the API schema from widening back to `number[]`.
- Runtime weekday/weekend scheduling behavior is unchanged from v0.8.96.
- Carries forward the v0.8.96 schedule feature, v0.8.95 deCONZ reconnect safety and v0.8.94 deCONZ settings/link unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.96

- Added optional execution-day restrictions for automations, with Monday-through-Sunday selection and a weekend convenience control.
- Existing automations remain unrestricted by default and continue to run every day.
- Execution-day checks use the configured SALTA timezone and are evaluated when a trigger is queued, covering state, event and time triggers consistently.
- Added the additive `automation_schedule_preferences` table without altering the existing `automations` table.
- Added configuration-backup compatibility for the new schedule table; older backups without it restore with all days enabled.
- Added frontend/API validation, German/English translations and regression coverage for weekday-only and weekend-only execution.
- Carries forward the v0.8.95 deCONZ reconnect safety, v0.8.94 deCONZ settings/link and v0.8.93 command retention unchanged.
- No manual database migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.95

- Prevented deCONZ button-state replays after network, router, VM or gateway connectivity interruptions from triggering SALTA automations.
- Added a recovery-baseline state: the first successful full reconcile after a detected interruption stores current button revisions without emitting `deviceEvent` automation triggers.
- WebSocket button messages now require a non-empty, genuinely changed deCONZ `lastupdated` revision before they can be considered a new press.
- Kept the v0.8.91 poll/WebSocket/reconcile exact-once deduplication active for normal steady-state missed-event recovery.
- Added `DECONZ_WEBSOCKET_CONNECTED`, `DECONZ_WEBSOCKET_ERROR`, `DECONZ_WEBSOCKET_CLOSED` and `DECONZ_RECOVERY_BASELINE` diagnostics under the existing internal `phoscon` log source.
- Added regression and release-validator coverage for reconnect baselining and duplicate/revision-less WebSocket event suppression.
- Carries forward the v0.8.94 deCONZ settings rename/link and v0.8.93 command-history retention unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.94

- Renamed the visible Phoscon integration settings to **deCONZ** while keeping internal `phoscon` adapter/source/API identifiers unchanged for compatibility.
- Added a direct **deCONZ-Oberfläche öffnen** / **Open deCONZ interface** link to the settings panel.
- The link follows the configured base address, opens in a new tab/window and accepts only HTTP/HTTPS URLs with `noopener noreferrer` protection.
- Added German/English translations, frontend regression coverage and release-validator contracts for the new settings naming and link behavior.
- Carries forward the v0.8.93 command-history retention and v0.8.91/v0.8.92 Phoscon/deCONZ button-event reliability fixes unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.93

- Added bounded retention for the persistent `commands` history so long-running SALTA installations cannot grow that table without limit.
- Command records older than 90 days are removed automatically.
- A hard cap keeps only the 10,000 newest command records even if an unusual command loop generates records much faster than normal.
- Retention runs during database initialization and after each newly persisted API command, so protection remains active without requiring restarts.
- Cleanup failures do not turn an otherwise successful device command into a command failure.
- Added regression and release-validator coverage for both retention limits and the runtime cleanup hook.
- Carries forward the v0.8.92 Phoscon test alignment and the v0.8.91 Phoscon button-event reliability fix unchanged.
- No table alteration, manual SQL migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.92

- Fixed the single stale `phoscon-websocket.test.ts` source-inspection assertion left behind by the v0.8.91 Phoscon button-event deduplication refactor.
- The test now validates the active `claimedSignature` exact-once gate instead of the removed `shouldEmit` implementation detail.
- Removed duplicate copies of the v0.8.91 deduplication assertions from that test while preserving their coverage once.
- Runtime Phoscon behavior is unchanged from v0.8.91.
- Carries forward the complete v0.8.91 Phoscon button-event reliability fix unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.91

- Fixed an intermittent Phoscon/deCONZ button-event race between the 15-second normal reconcile and the 2-second fallback button poll.
- Normal reconcile now emits a newly discovered button revision instead of silently updating the stored `buttonEventLastUpdated` value and consuming the automation trigger.
- Added cross-transport exact-once deduplication for WebSocket, fallback poll and reconcile using resource ID, button-event value and deCONZ `lastupdated`.
- Added pending-event claims and a bounded recent-event cache so concurrent or delayed deliveries cannot double-trigger an automation.
- Preserved button transport diagnostics and mark events recovered by normal reconciliation with `buttonEventTransport: "reconcile"`.
- Added runtime race regression coverage and release-validator contracts for missed-event recovery and duplicate suppression.
- Carries forward the v0.8.90 localization-completeness audit unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.90

- Completed a second German/English localization audit focused on dynamic runtime text rather than only static HTML.
- Expanded the catalogues to 930 explicit phrases and 97 dynamic patterns, covering DEBUG, adapter credentials/realtime status, HomeKit, Heating mode, battery warnings, device information, OpenCCU diagnostics, Presence and Automation messages.
- Fixed the remaining OpenCCU `toLocaleString()` calls so diagnostic and synchronization timestamps follow the selected SALTA language.
- Added phrase/pattern parity checks plus dynamic localization regression and release-validator contracts.
- Carries forward the v0.8.89 compact sidebar language selector and v0.8.88 CodeQL hardening.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.89

- Refined the compact sidebar language selector so its label and dropdown no longer fight for horizontal space.
- The sidebar language control now uses a stacked layout with a compact right-aligned selector to avoid clipped labels.
- Kept the larger language selector under **Settings → Appearance** unchanged.
- Added frontend regression coverage for the compact stacked sidebar language-control layout.
- Carries forward the v0.8.88 CodeQL security hardening, the v0.8.87 formatter regression fix and the v0.8.86 German/English localization unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.88

- Fixed the OpenCCU XML-RPC incomplete multi-character sanitization finding by rejecting unknown typed markup instead of stripping XML tags and decoding the remainder.
- Centralized the FRITZ!Box SOAP content-authentication MD5 calculations through the existing protocol `digestHash()` helper, removing direct literal `createHash("md5")` calls while preserving the FRITZ! TR-064 authentication result.
- Added regression tests for rejected unknown XML-RPC value markup and the scoped FRITZ! protocol digest path.
- Updated release validation and `SECURITY.md` so future direct literal MD5 calls in FRITZ!Box Presence are rejected and the protocol-only exception remains documented.
- Carries forward the v0.8.87 formatter regression fix and the v0.8.86 German/English localization unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.87

- Fixed the single v0.8.86 CI regression in the compact device-card energy formatter test.
- The isolated formatter test now injects the `appI18n.formatNumber()` dependency introduced by the German/English localization layer instead of evaluating the browser formatter without its required context.
- The test continues to verify Wh-to-kWh conversion independently from locale-formatting behavior, which remains covered by the dedicated i18n regression suite.
- Runtime JavaScript, localization behavior, database schema and deployment topology are unchanged from v0.8.86.
- Carries forward the full German/English localization feature from v0.8.86 unchanged.

## v0.8.86

- Added a browser-localized SALTA UI with **Automatic**, **Deutsch** and **English** language selection.
- Added a compact language selector in the sidebar, a matching selector under **Settings → Appearance**, and language selection on the login page.
- Language preference is stored per browser/device in the `salta_language` cookie; `Automatic` resolves the browser's first supported preferred language and falls back to German.
- Added external `public/i18n/de.json` and `public/i18n/en.json` catalogues plus the shared `public/i18n.js` localization runtime.
- Added translation of static HTML, newly rendered UI fragments, placeholders, titles and ARIA labels while explicitly protecting user-defined device, room, person and automation names.
- Added language-aware `Intl` number/date formatting for dashboard values, timestamps and automation temperatures.
- Added public no-session delivery of the localization runtime/catalogues so the login screen can be translated before authentication.
- Added regression coverage and release-validator contracts for language persistence, automatic detection, translation catalogues, user-content protection and public localization assets.
- Carries forward the v0.8.85 Appearance profile application fix unchanged.
- No database schema migration, new mandatory environment variable or npm dependency is required.

## v0.8.85

- Fixed Appearance profile preview so selecting or explicitly applying a profile writes that profile palette directly to the active CSS theme variables.
- Selecting Standard, Ocean, Forest, Warm or Graphite now immediately previews the profile on the current page.
- **Profil anwenden** uses the same direct palette path and confirms which profile is being previewed.
- Individual color editing and server-side Appearance persistence remain unchanged.
- Added regression coverage for the direct profile-to-CSS application path.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.84

- Fixed the two v0.8.83 frontend CI regressions caused by stale test expectations after the configurable Appearance integration.
- The authenticated application startup test now expects the saved Appearance palette to load after session authentication and before normal application data/navigation startup.
- The overview room-group test verifies `#eef2ff` as the default `--overview-room-bg` theme token and verifies that room blocks consume that configurable CSS variable.
- No runtime code, database schema, Appearance behavior, automation behavior, HomeKit behavior, dependency or deployment-topology change is required.

## v0.8.83

- Added a dedicated **Darstellung / Appearance** settings page with Standard, Ocean, Forest, Warm, Graphite and Custom profiles.
- Added separate light and dark palettes with 27 individually configurable central UI colors per mode.
- Individual color changes automatically switch the profile to Custom while preserving the rest of the selected palette.
- Added live preview, exact HEX editing and native color pickers.
- Made the overview room background a configurable theme token; Standard Light keeps `#eef2ff`.
- Appearance settings use the existing backed-up `notification_state` persistence and require no database migration.
- Added API validation/rate limiting and frontend/API regression coverage.
- Carries forward the v0.8.82 overview cleanup unchanged.

## v0.8.82

- Removed the descriptive subtitle below **Favoriten** on the overview.
- Replaced the overview room-group gradients from v0.8.81 with a single solid `#eef2ff` background.
- Removed alternating room-group coloring so every room boundary uses the same calm visual treatment.
- Added regression coverage for the subtitle removal and the solid room-group background.
- Carries forward the v0.8.81 room-group separation and the v0.8.80 Favorites lifecycle fix unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.81

- Removed the explanatory overview hint below **Geräte nach Räumen**.
- Improved visual separation of room sections on the overview by rendering each room group inside its own background block.
- Added regression coverage for the simplified overview heading and room-group styling.
- Carries forward the v0.8.80 Favorites lifecycle/CI fix unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.

## v0.8.80

- Fixed the v0.8.79 push-test regressions caused by the new canonical `favorite: false` device field.
- Registry lifecycle test fixtures now model the canonical favorite state explicitly instead of comparing an old pre-Favorites device shape.
- `ShellyAdapter.add()` now returns the canonical device stored in `DeviceRegistry` after persistence, preserving the existing contract that the returned device matches the registry representation.
- The Favorites feature, `device_favorites` persistence, overview rendering and backup/restore behavior from v0.8.79 are unchanged.
- No database schema migration, new mandatory environment variable, dependency or deployment-topology change is required.
