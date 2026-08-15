# SALTA v0.8.68

SALTA v0.8.68 fixes the strict TypeScript build regression found after v0.8.67. The Heating mode automation target, daily local-time trigger and all v0.8.67 regression fixes remain unchanged.

## v0.8.68 TypeScript build fix

- Fixed `TS2322` in `src/climate-mode.ts` where `Partial<Device["state"]>` allowed `undefined` values to be introduced when merging the hidden `system:climate-mode` state.
- `syncAutomationDevice()` now accepts SALTA's existing `DeviceState` type, whose values are restricted to `string | number | boolean | null`.
- This keeps the helper flexible for partial key sets while preserving the exact `DeviceState` value contract and avoiding `any` or unsafe casts.
- The optional `registry.get` / `registry.set` behavior introduced in v0.8.67 remains intact for isolated unit-test registries.
- The global Heating mode automation target and removal of the visible **Nur SALTA** badge remain unchanged.
- No database migration, new mandatory environment variable, npm dependency or deployment change is required.

## v0.8.67 regression fixes

- Fixed the `ClimateModeManager` regression that caused isolated climate-mode tests to fail with `this.registry.get is not a function`. Synchronization of the hidden `system:climate-mode` registry representation is now optional for lightweight registry implementations while the production `DeviceRegistry` continues to keep the system target state synchronized.
- Updated the automation-isolation regression test so it verifies the database automation store, logger and injected Climate mode callback independently of source-code line formatting.
- Updated the frontend automation regression test to match the intentional generic **Weiteres Ziel hinzufügen** label. The wording changed because automation targets can now be either physical/virtual devices or SALTA system functions such as Heating mode.
- Updated the compact overview regression test to verify that both `presence` and hidden `system` devices are excluded from normal device, reachability and power counters.
- The visible **Nur SALTA** badge remains removed from the Heating mode overview card as requested.
- Carries forward the complete v0.8.66 Heating mode automation target and the v0.8.65 daily local-time trigger.
- No database migration, new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.66 heating-mode automation target

- Added the global SALTA **Heating mode** as a first-class target in the automation editor's **Then** stage.
- Heating mode provides two automation actions: **Summer mode** and **Winter mode**.
- The target can be used as the primary action or as one of the additional actions in a rule.
- Time-triggered rules can therefore perform schedules such as `22:00 → Heating mode → Winter mode` without creating or selecting a dummy device.
- Heating-mode actions use the same `ClimateModeManager` as the overview and settings UI. Summer mode turns compatible thermostats off; Winter mode applies the manual or automatic winter behavior configured under **Settings → Heating mode**.
- Added an internal hidden `system:climate-mode` target for automation persistence and execution. It is not shown on normal device pages, is excluded from overview device counts, and remains disabled for HomeKit publication.
- Added the additive `automation_system_actions` table for SALTA-level automation actions. No destructive `ALTER TABLE` migration is required.
- Configuration and disaster-recovery backups include system actions. Existing backups created before v0.8.66 remain compatible and restore with no system-action rows.
- Removed the visible **Nur SALTA** badge from the Heating mode overview card. The underlying Heating mode remains a SALTA-local control and is still explicitly excluded from HomeKit.
- Added regression coverage for the automation engine, API normalization, database schema/persistence, frontend target selection and backup/restore.
- No new mandatory environment variable or npm dependency is required.

## v0.8.65 daily automation time triggers

- Added **Time** as a selectable trigger type in the automation editor's **When** stage, alongside the existing device trigger.
- A time-triggered automation runs once per local calendar day at the selected `HH:MM` wall-clock time and does not require a trigger device.
- The scheduler uses SALTA's configured `TZ` value; the existing default remains `Europe/Berlin`. A 07:30 schedule therefore stays at 07:30 across daylight-saving changes.
- The repeated autumn clock hour is de-duplicated so the same daily time rule is not intentionally executed twice on one local calendar day.
- Existing **Only if** conditions remain available for time-triggered rules.
- Existing primary and additional target actions remain available, including Shelly/Zigbee/Hue/OpenCCU/virtual-device actions and thermostat target temperatures.
- Time schedules are persisted in a new additive `automation_time_triggers` table. SALTA creates the table automatically during normal startup; no manual migration command and no destructive `ALTER TABLE` statement are required.
- Existing device-trigger automations keep their current persistence and behavior.
- Configuration and disaster-recovery backups now include time schedules. Older backup files without `automation_time_triggers` remain compatible and restore with no time schedules.
- Added regression coverage for scheduler behavior, local timezone/DST handling, API normalization, database schema/persistence, frontend editing and backup/restore.
- In v0.8.65 a time trigger is intentionally exclusive: it cannot be OR-combined with additional device triggers inside the same automation. More advanced calendar/combined scheduling can be added later without changing the simple daily-time contract.
- No new mandatory environment variable or npm dependency is required.

## v0.8.64 project story and README improvements

- Added a new **Why SALTA exists** section to the README.
- Documented the practical motivation behind SALTA: keeping proven local hardware useful and maintaining stable smart-home behavior even when surrounding platforms and integrations evolve.
- Explained the project's origin around continued use of reliable first-generation Shelly 1 devices, Home Assistant integration problems experienced in 2026, and changes to the RaspberryMatic/OpenCCU integration path used by the original installation.
- Clarified that SALTA is not intended to replace Home Assistant or compete with its broad feature set. Its narrower scope is deliberate.
- Added explicit project priorities: reliability before novelty, local-first operation, support for existing hardware, understandable integrations, controlled upgrades and household acceptance.
- Refined the opening description of SALTA to better communicate its reliability-first and long-term-compatibility goals.
- Documentation-only release: no database schema migration, new mandatory environment variable, new npm dependency, runtime behavior or deployment change is required.

## v0.8.63 settings navigation cleanup

- Renamed the visible **Settings → Phoscon / Zigbee** navigation entry to **Settings → Phoscon**.
- Renamed the visible **Settings → OpenCCU / HomeMatic** navigation entry to **Settings → OpenCCU**.
- Updated the corresponding README settings paths.
- Internal adapter identifiers, APIs, device sources, and integration behavior are unchanged.
- No database schema migration, new mandatory environment variable, new npm dependency, or deployment change is required.

## v0.8.62 CI test maintenance

- Updated the window-covering live-refresh regression test so it also protects active Philips Hue color-temperature and color controls from being re-rendered while the user is interacting with them.
- Updated the room-grouped overview regression test so its expected device-source description includes Philips Hue.
- The application code already contained both behaviors; this release corrects the stale test expectations instead of removing or weakening Hue functionality.
- No database schema migration, new mandatory environment variable, new npm dependency, or deployment change is required.

## v0.8.61 build fix

- Fixed `TS18048` errors in `src/hue-adapter.ts` by expressing the existing runtime guarantee that a successfully discovered Hue Bridge always has a `bridgeId` in the TypeScript return type.
- Fixed `TS18048` errors in `src/hue-tls.ts` under `noUncheckedIndexedAccess` by assigning safe fallback values to destructured IPv4 octets.
- The runtime validation remains unchanged: an invalid Hue discovery response without a bridge ID still fails with `HUE_INVALID_RESPONSE`.
- No database schema migration, new mandatory environment variable or new npm dependency is required.

## Philips Hue functionality carried forward from v0.8.60

### Philips Hue Bridge integration

- Added **Philips Hue** as a first-class SALTA device source parallel to Shelly, Phoscon/Zigbee and OpenCCU/HomeMatic.
- Added a dedicated **Philips Hue** page with room filtering, search, connection status and manual synchronization.
- Added **Settings → Philips Hue** with local mDNS bridge discovery, manual IP/hostname fallback, link-button pairing, application-key status and disconnect.
- SALTA pairs with the bridge using the physical Hue link button and stores the bridge-issued application key encrypted with `SALTA_ENCRYPTION_KEY`.
- The application key is never returned to the browser after it has been stored.
- Disconnecting Hue removes synchronized Hue records from SALTA but does not remove lights, accessories or configuration from the Philips Hue Bridge.

## Hue API v2 devices and controls

- Added local Hue API v2 resource discovery for Hue light resources and Hue smart plugs.
- Hue lights support `On`, `Off` and `Toggle`.
- Dimmable Hue lights expose brightness control when the bridge reports the capability.
- Color-temperature lights expose a Kelvin slider derived from the bridge-reported mirek range.
- Color-capable Hue lights expose a local color picker and SALTA converts HTML colors to Hue xy coordinates for v2 commands.
- Hue smart plugs are represented as SALTA outlets instead of lights.
- Reachability is derived from the Hue `zigbee_connectivity` resource.
- Hue model, firmware, bridge/resource identifiers and Hue archetype metadata are shown in the SALTA device details.
- Existing SALTA names, room assignments, presentation metadata and HomeKit choices are preserved across Hue reconciliation.

## Local realtime updates

- Added the Hue API v2 local SSE event stream at `/eventstream/clip/v2` using the bridge-issued application key.
- Valid Hue event frames trigger a coalesced fast reconciliation so state changes made in the Hue app or by another local Hue client appear in SALTA quickly.
- A 15-second periodic reconciliation remains active as a fallback when realtime delivery is unavailable.
- Event-stream reconnects use bounded exponential backoff and do not require restarting SALTA after a temporary Hue Bridge or network interruption.

## HTTPS and local-network security

- Hue communication is HTTPS-only.
- SALTA bundles the current Signify Hue Bridge CA roots used by updated Hue Bridge generations and keeps TLS certificate-chain verification enabled.
- After the bridge identity is discovered, authenticated requests and the realtime event stream validate the certificate against the Hue Bridge ID.
- SALTA does not use a global or Hue-specific `rejectUnauthorized: false` bypass.
- Hue targets are resolved before connection and must use private, loopback or link-local addresses; public Internet targets and non-standard HTTPS ports are rejected.
- mDNS discovery, pairing, settings writes, disconnect and manual reconciliation use explicit API rate limits in addition to SALTA's normal authenticated API protection.
- Hue credential readability is included in SALTA readiness/credential diagnostics without logging the application key.

## Automations and HomeKit

- Hue lights and plugs automatically participate in the existing automation target catalogue through the normal SALTA capability model.
- Binary Hue targets support `On`, `Off` and `Toggle` in automations.
- Hue devices are imported with SALTA HomeKit publication disabled by default to avoid creating duplicate Apple Home accessories when the Hue Bridge is already connected directly to Apple Home.
- HomeKit can still be enabled explicitly per supported Hue device in SALTA device settings.

## v0.8.59 behavior carried forward

- Virtual devices can be configured as persistent switches or 500 ms momentary buttons.
- Momentary virtual buttons remain writable HomeKit switch accessories so Apple Home geofences can activate them while SALTA resets them automatically.
- Existing virtual switches can be converted without changing their SALTA device ID or existing automation references.
- The obsolete virtual self-reset explanatory hint remains removed from the automation editor.
- Persistent virtual switches retain the safe opposite-state self-reset mechanism from v0.8.58.

## Compatibility

- v0.8.65 adds the `automation_time_triggers` table automatically during normal schema initialization; no manual database migration is required.
- Hue credentials continue to reuse SALTA's existing encrypted `adapter_settings` persistence.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- No new mandatory environment variable is required.
- No new npm dependency is introduced; the Hue client uses Node.js built-in HTTPS, DNS and networking APIs.
- SALTA continues to use `network_mode: host` for HomeKit HAP/mDNS.
- PostgreSQL remains on Docker's normal bridge network and is published only on host loopback.
- `/opt/SALTA/migrate-homekit-storage.sh` remains necessary only for HomeKit pairing state created before v0.8.41.

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
