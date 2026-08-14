# Changelog

## v0.8.51

- Replaced the experimental PostgreSQL host-network deployment with a simpler production topology: SALTA alone uses host networking for HomeKit/mDNS, while PostgreSQL remains on Docker's standard bridge network.
- PostgreSQL is published only on host loopback as `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`; SALTA reaches it through the same loopback endpoint.
- Removed all custom production `frontend` / `backend` networks and the retired `internal: true` workaround.
- Restored the PostgreSQL healthcheck to the container-local `127.0.0.1:5432` endpoint.
- Added release-validation and deployment-test contracts that require exactly one host-network service and loopback-only PostgreSQL publication.
- Documented the one-time legacy HomeKit migration path `/opt/SALTA/migrate-homekit-storage.sh`, including source `/app/persist` and target `/var/lib/salta/homekit`.
- No database migration is required; legacy HomeKit migration is required only for installations already paired before v0.8.41.

## v0.8.50

- Reworked the HomeKit production networking topology so both SALTA and PostgreSQL use host networking, eliminating Docker NAT/port-publishing from the database path.
- PostgreSQL is started with `listen_addresses=127.0.0.1` and `port=${POSTGRES_HOST_PORT:-5433}`, so it remains reachable only through host loopback and is not exposed to the LAN.
- Updated the PostgreSQL healthcheck to target the same loopback-only host-network port used by SALTA.
- Added deployment regression coverage and release validation requiring both host-network modes and rejecting any reintroduction of PostgreSQL port publishing.
- Supersedes the unsuccessful v0.8.49 bridge-network workaround. No database or HomeKit storage migration is required.

## v0.8.49

- Fixed the production Docker networking topology introduced for HomeKit host networking: PostgreSQL no longer uses the custom `internal: true` backend network.
- PostgreSQL now uses Docker's normal bridge networking while remaining published only on host loopback at `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`.
- This keeps PostgreSQL unavailable from the LAN while restoring reliable database connectivity for the host-networked SALTA container.
- Added deployment regression coverage and release validation that reject the broken combination of host-networked SALTA with PostgreSQL on an internal backend bridge.
- Updated deployment and security documentation to describe the corrected network topology.
- No database migration, HomeKit storage migration, new dependency or new mandatory environment variable is required.

## v0.8.48

- Fixed HomeKit QR helper delivery by registering `/homekit-qr.js` in SALTA's authenticated static-file map instead of allowing the SPA fallback to return `index.html`.
- The HomeKit QR helper is delivered with a JavaScript MIME type and `Cache-Control: no-store`.
- Added a server regression test that requests `/homekit-qr.js` directly and verifies HTTP 200, JavaScript content, no-store caching and QR helper source rather than HTML fallback content.
- Extended the release validator so releases fail if the HomeKit QR helper is referenced by the UI but omitted from the static-file map.
- Kept the v0.8.47 pairing-code synchronization and local-only QR generation behavior.
- No database migration, HomeKit storage migration, new dependency or new mandatory environment variable is required.

## v0.8.47

- Fixed the HomeKit pairing QR code rendering in the web interface by emitting explicit SVG width and height attributes and keeping the pairing panel layout square and stable.
- Fixed the displayed HomeKit manual pairing code so SALTA now exposes the effective runtime bridge pincode for unpaired bridges instead of relying only on the stored settings value.
- Hardened HomeKit pairing resets by generating both a fresh bridge username and a fresh pairing code before republishing the bridge.
- Preserved local-only QR generation with no external QR service, no new npm dependency and no plain-text setup URI embedded in the SVG output.
- No database migration, HomeKit storage migration or new mandatory environment variable is required.

## v0.8.46

- Added a fully local HomeKit pairing QR code under **Settings → HomeKit**.
- The QR code is generated directly from HAP-NodeJS `setupURI()` data and can be scanned with Apple Home; the manual HomeKit pairing code remains available as a fallback.
- The authenticated HomeKit settings API exposes `setupUri` only while the bridge is unpaired; paired responses omit both the setup URI and pairing code.
- Added a small dependency-free QR encoder limited to the standardized HomeKit `X-HM://` alphanumeric setup-URI contract. No external QR service or new npm dependency is used.
- Added an independent QR reference-vector regression test and frontend/API coverage for QR pairing.
- Extended the release validator and `npm run check` to include the HomeKit QR asset.
- No database migration, new mandatory environment variable or production-networking change is required.

## v0.8.45

- Fixed the HomeKit shared-command-dispatcher regression test that still depended on obsolete exact source-text fragments from the pre-refactor bridge implementation.
- Replaced the brittle `private commander:` / minified call-text assertions with TypeScript AST checks that verify the actual contract: `HomeKitBridge` receives a private commander and HomeKit writes call `this.commander.command(...)` with the current device ID and `source: "homekit"`.
- Kept the production HomeKit implementation unchanged; this release carries forward the complete HomeKit runtime/pairing functionality prepared in the v0.8.44 candidate.
- No database migration, new dependency, API change or production-networking change is introduced by this CI fix.

## v0.8.44

- Added a dedicated **Settings → HomeKit** page with live bridge enable/disable, bridge name and network-interface selection.
- Added authenticated HomeKit runtime status including running/advertised/pairing state, bridge identity, HAP port and eligible/published device counts.
- Added secure pairing-code display only while unpaired and an explicit pairing-reset action that generates fresh HomeKit pairing credentials without logging them.
- Made the HAP bridge start, stop and reconfigure at runtime without restarting the SALTA process.
- Persisted global HomeKit runtime settings through existing encrypted SALTA state without a destructive database migration.
- Expanded HomeKit publication to compatible thermostats and read-only motion, contact, temperature, humidity, light, water-leak and smoke sensors; battery information is attached when available.
- Kept HomeKit commands on the shared SALTA command router and publish thermostats only when both target-temperature and mode commands are supported.
- Switched the production SALTA container to host networking for reliable LAN mDNS/HAP advertisement while keeping PostgreSQL loopback-only on `127.0.0.1:${POSTGRES_HOST_PORT:-5433}`.
- Preserved the existing persistent `/var/lib/salta/homekit` HAP storage and Disaster Recovery coverage for HomeKit identity and pairing state.
- Added API, frontend, device-capability, deployment and release-validator regression coverage for the completed HomeKit integration.
- No new mandatory environment variable, npm dependency or destructive database migration is required.

## v0.8.43

- Moved runtime DEBUG configuration from the Pushover notification panel to a dedicated **Settings → General** section.
- Replaced the previous boolean DEBUG switch with explicit `Off`, `Errors` and `Verbose` levels.
- Added a persistent header badge while DEBUG is active so operators can immediately see `DEBUG · ERRORS` or `DEBUG · VERBOSE`.
- Limited DEBUG Pushover delivery by level: `Errors` reports failed automatic corrections, while `Verbose` also reports successful corrective intervention.
- Kept routine all-clear thermostat checks silent to avoid notification noise.
- Preserved backward compatibility with the v0.8.42 boolean DEBUG setting by mapping an enabled legacy value to `Verbose`.
- Fixed release-version handling so current release surfaces can be bumped without rewriting historical compatibility documentation.
- Restored the HomeKit migration documentation contract to the actual pre-v0.8.41 boundary.
- No database schema migration, new npm dependency or new mandatory environment variable is required.

## v0.8.42

- Added a Summer-mode thermostat guard that checks compatible thermostats every 12 hours and restores any non-OFF thermostat to SALTA's existing OFF state.
- Added a delayed startup guard check so unintended thermostat mode drift is corrected after integrations initialize.
- Kept Winter mode untouched and reused the existing OpenCCU OFF mapping, including manual/hand mode at minimum target temperature where no native OFF mode exists.
- Added optional DEBUG-Pushover notifications for thermostat corrections and failures without sending routine all-clear messages.
- Persisted the DEBUG switch in the existing notification-state storage, avoiding any database schema migration and preserving v0.8.41 backup compatibility.
- Extracted the shared Pushover sender into a dedicated module for battery and climate diagnostics.
- Added regression coverage for Summer-mode drift correction, Winter-mode inactivity and DEBUG notification delivery.
- No new npm dependency or mandatory environment variable was added.
- Added a repository-controlled CodeQL Advanced Setup workflow that continues scanning both JavaScript/TypeScript and GitHub Actions.
- Temporarily pinned the CodeQL analysis bundle to v2.26.2 to avoid the upstream v2.26.3 GitHub Actions database-finalization regression without disabling Actions scanning.

## v0.8.41

- Removed the obsolete standalone test-tsconfig release requirement completely and added a CI-visible validator contract marker so checkout state can be verified unambiguously.

- Removed the standalone `tsconfig.tests.json` build dependency; test preflight now derives its test-inclusive configuration directly from `tsconfig.json`.
- Fixed the Disaster Recovery AES-GCM authenticated-data header so an exported backup can be decrypted and restored with the same password.
- Fixed Vitest mock hoisting in the configuration-backup transaction tests.
- Fixed the Disaster Recovery frontend regression test to parse `app.js` before AST inspection.
- Removed fake timers from the Fastify Disaster Recovery import test so the request lifecycle cannot deadlock in CI.
- Fixed the Disaster Recovery restore transaction state so TypeScript can prove the optional external rollback/finalize transaction is initialized before use.
- Replaced the unreleased v0.8.40 configuration-only backup with a password-encrypted full Disaster Recovery backup.
- Added AES-256-GCM + scrypt protection for one portable backup file containing persistent SALTA configuration, encrypted integration credentials, restorable application runtime settings and HomeKit/HAP pairing state.
- Added persistent Docker runtime storage at `/var/lib/salta` and configured HAP-NodeJS to keep its pairing data under `/var/lib/salta/homekit`.
- Added `migrate-homekit-storage.sh` and integrated it into `update.sh` so pre-v0.8.41 HomeKit pairing data can be copied from the legacy container path before the first v0.8.41 recreate.
- Restored application identity settings such as the administrator credentials, `SALTA_ENCRYPTION_KEY`, HomeKit identity/PIN and application security/rate-limit settings from the encrypted backup after restart.
- Kept host/bootstrap-only Docker values such as PostgreSQL credentials, published ports and `SALTA_HEALTH_TOKEN` outside the portable backup; mismatched ports/timezone are reported after restore.
- Made configuration + runtime/HomeKit restore transactional across PostgreSQL and filesystem state as far as possible, with rollback before database commit on restore failure.
- Added backend, API, frontend, deployment and release-validation coverage for encrypted Disaster Recovery backups and persistent HomeKit storage.

## v0.8.39

- Changed the device-card `Energie` display from Wh to kWh while keeping the underlying device/API value unchanged.
- Energy values are converted only for presentation and shown with up to three decimal places, so small totals remain meaningful.
- Kept the separate `Verbrauch` display in Wh.
- Extended the existing AST-backed frontend device-card test with behavioral formatter checks instead of fragile full-source comparisons.
- No dependency, database, API, HomeKit or adapter behavior changed.

## v0.8.38

- Added a compact **Tageslicht** card to the Overview, positioned directly left of the global heating-mode card.
- The card reads the existing Phoscon/deCONZ `Daylight` sensor and shows the current solar phase, daylight/night state, sunrise and sunset.
- The Daylight card refreshes with the normal live device refresh and does not require a new backend API, database table or environment variable.
- Added a graceful unavailable state when no Phoscon Daylight sensor is present or the sensor cannot be reached.
- Reworked the global Overview system grid into a responsive three-card layout for Daylight, heating mode and battery status.
- Extended the existing AST-backed frontend system-control regression test instead of adding brittle exact JavaScript source comparisons.
- No dependency, persistence, HomeKit or device-control behavior changed.

## v0.8.37

- Reduced the persistent System Log retention cap from 2,000 to the newest 100 entries while keeping the existing 30-day age limit.
- Capped `/api/logs` at 100 entries and changed the frontend to request at most 100 records.
- Reworked the System Log page into a compact SALTA-style layout with a small toolbar, entry counter, compact filters and reduced action buttons.
- Replaced large always-visible detail blocks with expandable `Details` sections so normal log rows stay compact.
- Added compact severity badges, localized source labels and tighter timestamps/code presentation, including dark-theme styling.
- Added regression coverage for the 100-entry API limit, persistence cap, compact layout and responsive behavior.
- No database migration, environment-variable or dependency change is required.

## v0.8.36

- Corrected the deployment quality gate so standalone Docker Compose configuration, not optional shell convenience scripts, defines the mandatory production contract.
- CI and release verification now syntax-check `install.sh`, `update.sh`, `backup.sh` and `restore.sh` only when those files are present instead of failing the build when a helper script is absent.
- Release validation now requires `docker-compose.image.yml` and `.env.example` while validating optional helper scripts conditionally.
- Deployment regression tests no longer require convenience scripts and continue to verify them when available.
- `version:set` no longer depends on `install.sh` being present, but still updates its embedded version when the helper exists.
- Updated installation/update documentation so direct `docker compose --env-file .env -f docker-compose.image.yml ...` commands are the authoritative production path.
- No runtime, database, HomeKit, climate, battery-warning or dependency behavior changed.

## v0.8.35

- Moved the configurable Winter thermostat target mode from the Overview into a dedicated **Settings → Heizmodus** panel.
- The Overview now only switches between Summer and Winter and shows the configured Winter target mode as read-only metadata.
- Added a persistent Winter-mode settings API that stores `Handbetrieb` or `Automatik` without immediately changing thermostat state.
- Winter activation now always reads the stored Winter target mode on the server instead of accepting it from the Overview request.
- Added **Aktuellen Modus jetzt anwenden** in Settings for an explicit save-and-apply workflow.
- Added API and frontend regression coverage proving that saving the Winter target mode does not issue thermostat commands.
- Kept the global heating mode explicitly SALTA-only and excluded from HomeKit.
- No database migration, environment-variable or dependency change is required.

## v0.8.34

- Restored and explicitly guarded the required `update.sh` production updater after CI showed that the repository checkout could miss it while the deployment regression suite still attempted to read it at module load time.
- Changed deployment regression tests to verify required production files explicitly before inspecting their contents, avoiding opaque `ENOENT` suite-load failures.
- Added `install.sh`, `update.sh`, `backup.sh`, `restore.sh`, `docker-compose.image.yml` and `.env.example` to the release validator's required-file contract.
- Moved deployment-script existence and shell-syntax validation to immediately after repository checkout in CI and release verification, before dependency installation and the full test suite.
- Missing deployment scripts now fail fast with a clear GitHub Actions error that identifies the missing file.
- No runtime, database, HomeKit, climate-mode, battery-warning, Pushover or dependency behavior changed.

## v0.8.33

- Compactified the Overview heating-mode and battery-warning cards and aligned their typography, spacing, icons and actions with the rest of the SALTA UI.
- Added a stable `data-homekit-exposed="false"` contract to the SALTA-only heating control while keeping Summer/Winter behavior unchanged.
- Changed thermostat execution details to compact status chips and moved the Pushover action into the battery-card header.
- Reduced battery-warning height by summarizing affected devices inline.
- Replaced fragile device-config and climate frontend source-string assertions with AST-based function/call/object inspection.
- Consolidated duplicate device-name and device-presentation regression tests into the shared device-dialog contract test.
- Moved test-only inspection helpers out of `src` so they are no longer compiled into the production `dist` tree.
- Optimized `npm run check` to avoid the duplicate production TypeScript compile and the duplicate test-symbol preflight.
- Removed historical release-validator checks that inspected individual test-file implementations and added generic anti-fragility guards instead.
- No database, runtime API, dependency or HomeKit behavior changed.

## v0.8.32

- Fixed the frontend system-controls regression test introduced in v0.8.31.
- The Summer button already called `applyClimateMode('summer')` correctly from `public/index.html`; the test incorrectly searched for that inline handler in `public/app.js`.
- The regression test now verifies both Summer and Winter button bindings in the HTML and separately verifies the `applyClimateMode()` implementation and climate-mode API call in JavaScript.
- No runtime climate-mode, battery-warning, Pushover, database, HomeKit or dependency behavior changed.

## v0.8.31

- Added a persistent SALTA-only global **Summer / Winter** heating mode that is never exposed as a HomeKit accessory.
- Summer mode sets all compatible thermostats to `OFF`; Winter mode can apply either manual (`Hand`) or automatic operation to all compatible thermostats.
- Added a compact Overview control with thermostat counts and the result of the last global mode application.
- Added central battery monitoring across all device states that expose a battery percentage or explicit `lowBattery` flag.
- Added encrypted Pushover User Key and Application API Token settings plus a test-notification action.
- Added one aggregated battery warning via Pushover with a strict seven-day global cooldown.
- Added an Overview battery-warning status and a detailed warning list in Settings.
- Added Shelly Gen2+ `DevicePower` battery-percentage parsing.
- Added additive persistence tables for climate mode, notification credentials/settings and notification throttling.
- Added regression coverage for climate-mode commands, battery detection, weekly Pushover throttling, Shelly DevicePower parsing and the new frontend controls.
- No npm dependency was added or intentionally changed.

## v0.8.30

- Fixed two frontend regression tests that still expected the pre-v0.8.29 device configuration payload.
- Kept the existing name, room and presentation assertions while adding checks for the HomeKit publication and SALTA-room inheritance fields.
- No runtime HomeKit, device, database or dependency behavior changed.

## v0.8.29

- Added per-device HomeKit publication controls, optional HomeKit names and SALTA-room inheritance.
- Added additive `device_homekit_settings` persistence while preserving existing HomeKit enabled states.
- Prevented unsupported devices from being coerced into generic HomeKit switch accessories.
- Added HomeKit compatibility and target-room information to the device configuration dialog.
- Added regression coverage for HomeKit settings, room inheritance and adapter-refresh persistence.

## v0.8.28

- Optimized Shelly Gen2+/Gen3/Gen4 background polling so all logical channels of the same physical device share one `Shelly.GetStatus` request per reconciliation cycle.
- Added one retry for transient Shelly status failures.
- Added a three-cycle offline hysteresis to avoid false offline states caused by short Wi-Fi or RPC interruptions.
- Successful polls immediately restore online state and continue updating the existing `lastSeen` timestamp only after successful contact.

All notable changes to SALTA are documented in this file.

## 0.8.27

- Added a prominent **Zuletzt gesehen** indicator to the Shelly device configuration header.
- Kept the existing read-only **Zuletzt gesehen** value in the technical device-information grid.
- Corrected Shelly `lastSeen` semantics so failed refresh attempts no longer overwrite the timestamp of the last successful device contact.
- Added regression coverage proving an unreachable Shelly keeps its previous successful `lastSeen` timestamp.
- Kept database schema, APIs and npm dependencies unchanged apart from the SALTA root version.

## 0.8.26

- Consolidated top-level SALTA widths into shared CSS layout tokens for the main page, common side columns, Settings and dialog sizes.
- Removed the later hard-coded main-width override so the application width now has one canonical definition.
- Reworked the device configuration dialog into a wider detail view with a compact source/type/room/status header.
- Added a read-only device-information grid with common metadata plus Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic and virtual-device details.
- Added copy actions for technical identifiers and retained the existing Shelly local web-interface shortcut inside the detail view.
- Added dynamic numbering for visible device-configuration sections so source-specific hidden sections no longer create duplicate/skipped numbers.
- Added frontend and release-validation coverage for the consolidated layout widths and richer device-detail dialog.
- Kept database schema, APIs and npm dependencies unchanged apart from the SALTA root version.

## 0.8.25

- Fixed the v0.8.24 CI regression caused by `frontend-device-grouping.test.ts` still expecting the previous longer Overview helper text.
- Aligned the regression test with the intentional compact wording `Shelly-, Zigbee-, HomeMatic- und virtuelle Geräte nach Raum.`.
- Kept the compact Overview header, Presence summary and room-grouped device behavior unchanged.
- No runtime behavior, database schema, API or dependency-tree changes are included apart from the SALTA root version.

## 0.8.24

- Made the upper Overview area more compact with a smaller dashboard-specific title, tighter spacing, smaller summary cards and a smaller synchronization action.
- Added a fifth `Anwesenheit` summary card based on the existing virtual `presence:house` / `presence-group` device.
- Shows `Zuhause` or `Niemand` plus the current `x von y anwesend` count without introducing any second Presence polling path.
- Keeps Presence devices excluded from the existing device, reachability and power counters so those metrics retain their previous meaning.
- Added responsive five/three/two-column summary behavior, with the Presence card spanning the mobile row.
- Added dedicated frontend regression coverage and release-validation guards for the compact Overview and Presence summary.
- Kept the database schema, APIs and npm dependency tree unchanged apart from the SALTA root version.

## 0.8.23

- Made automation rule cards substantially more compact by reducing padding/gaps, moving edit/delete into header icon actions and placing the last-event timestamp in the metadata row.
- Removed the redundant `No additional condition` row when a rule has no condition.
- Fixed rule summaries so every OR-linked trigger device is visible instead of only showing the primary device plus a trigger count.
- Grouped multiple button events from the same device into one compact trigger entry while keeping different devices separated by an explicit OR marker.
- Added runtime frontend regression coverage for multi-device trigger summaries and compact-card presentation.
- Extended release validation to prevent regressions in complete OR-trigger summaries and compact automation cards.
- Kept the database schema, automation persistence format and npm dependency tree unchanged apart from the SALTA root version.

## 0.8.22

- Documented the FRITZ! TR-064 SOAP content-authentication MD5 requirement directly at the two protocol-mandated hash operations.
- Added three narrow, query-specific CodeQL suppressions for findings #8, #9 and #10 only on those two interoperability hashes; the first expression uses one `codeql[...]` and one supported `lgtm[...]` annotation because both queries report the same line.
- Kept the AVM-specified `MD5(uid:realm:password)` and `MD5(secret:nonce)` calculation unchanged so FRITZ!Box `ClientAuth` remains compatible.
- Added a security-policy section clarifying that the MD5 operations are challenge-response protocol calculations, not SALTA password storage or password KDFs.
- Extended release validation to require exactly two direct FRITZ!Box MD5 calls and the corresponding narrow CodeQL suppressions, preventing the exception from spreading to other SALTA code.
- No dependency, database, API, UI, or runtime behavior change is included.

## 0.8.21

- Updated transitive `fast-uri` 3.x from `3.1.4` to `3.1.5` to remediate GHSA-7p8r-x3mc-p8w7 / CVE-2026-18446.
- Updated the nested `fast-uri` 4.x copy from `4.1.1` to `4.1.2` for the same host-confusion fix.
- Updated development-only `postcss` from `8.5.20` to `8.5.23` to remediate GHSA-fxqj-rqcc-2cmp / CVE-2026-69153.
- Kept all direct SALTA dependency ranges unchanged; only patched transitive lockfile versions were selected.
- Added release validation guards preventing reintroduction of the known-vulnerable `fast-uri` and PostCSS versions.
- No database, API or runtime feature changes are included in this security-only release.

## 0.8.20

- Fixed FRITZ!Box TR-064 SOAP requests being rejected with HTTP 411 `Length Required` by adding an explicit UTF-8 `Content-Length` header.
- Prevented Node.js from using chunked transfer encoding for FRITZ!Box SOAP POST bodies.
- Applied the framing fix to normal Hosts calls, HTTP Digest retries and SOAP content-level authentication requests.
- Added a SALTA TR-064 user agent and explicit connection framing aligned with FRITZ! TR-064 request examples.
- Added dedicated HTTP 411 diagnostics to the Presence UI and API.
- Added regression coverage for exact SOAP body length and absence of `Transfer-Encoding: chunked`.
- Extended release validation so explicit SOAP `Content-Length` handling cannot be removed accidentally.
- Kept the database schema and npm dependency tree unchanged apart from the SALTA root version.

## 0.8.19

- Changed FRITZ!Box Hosts calls to try the rights-free SOAP request before negotiating authentication.
- Kept HTTP Digest and SOAP content-level authentication as fallbacks only when FRITZ!OS actually requests authentication.
- Added discovery of the Hosts `controlURL` from `/tr64desc.xml` with the canonical `/upnp/control/hosts` path as a compatibility fallback.
- Cached the discovered Hosts control endpoint to avoid repeated description requests during normal presence polling.
- Added the safe Presence `errorCode` to structured system-log details for easier diagnostics without exposing credentials.
- Added regression coverage for no-auth-first Hosts calls, deferred content authentication and discovered control URLs.
- Kept the database schema and npm dependency tree unchanged apart from the SALTA root version.

## 0.8.18

- Added persistent System Log entries for failed FRITZ!Box Presence connection tests.
- Added persistent error logging for scheduled TR-064 synchronization failures and warning logging for individual MAC-address query failures.
- Added recovery events when the FRITZ!Box connection or an individual presence target becomes healthy again.
- Deduplicated repeated scheduled Presence errors so short polling intervals do not flood the System Log.
- Kept explicit manual connection-test attempts individually visible as diagnostic events.
- Ensured Presence diagnostics never include the FRITZ!Box password or other secret material.
- Added a direct **System Log** link to failed FRITZ!Box connection states on the Presence page.
- Cleared stale per-device error state after recovery and removed stale logging state when presence targets are deleted.
- Removed an accidental duplicate `reload()` declaration in the Presence adapter source.
- Kept the database schema and npm dependency tree unchanged apart from the SALTA root version.

## 0.8.17

- Added AVM SOAP content-level authentication (`InitChallenge` / `ClientAuth`) for FRITZ!Box TR-064 Hosts requests.
- Kept standard HTTP Digest authentication as a compatibility fallback instead of replacing it.
- Correctly handles FRITZ!OS SOAP authentication faults with error code `503` instead of reporting them as a generic presence failure.
- Added distinct errors for authentication required, invalid credentials and insufficient TR-064 user permissions.
- Added regression tests using the official AVM content-authentication example digest.
- Fixed an accidental duplicate presence-device initialization statement in the v0.8.16 source tree.
- Kept the database schema and npm dependency tree unchanged apart from the SALTA root version.

## 0.8.16

- Fixed unsaved FRITZ!Box Presence credentials being overwritten by the five-second live refresh while the user was editing the form.
- Added a form-level dirty state so protocol, host, port, TLS option, username, password, polling interval and absence delay remain untouched until the user explicitly saves them.
- Kept live connection status, household presence and presence-device cards updating while unsaved connection settings are protected.
- Reset the dirty state only after a successful settings save, so the password field is cleared only after SALTA has actually stored the new password.
- Extended frontend and release-validation coverage to prevent periodic refreshes from reintroducing the credential-loss regression.
- Kept the database schema and npm dependency tree unchanged apart from the SALTA root version.

## 0.8.15

- Reworked the FRITZ!Box Presence connection card so TR-064 reachability is visible independently of whether automatic presence polling is enabled.
- Added persistent in-memory manual connection-test status with success/failure, host count, tested endpoint and test timestamp.
- Moved **Connection test** next to the connection status so the result is immediately visible instead of only appearing as a toast.
- Reorganized the TR-064 endpoint form: the FRITZ!Box host now uses the full row, with protocol and port arranged as two equal controls below it.
- Preserved unsaved connection fields while refreshing the status after a manual test.
- Added distinct neutral, pending, connected and failed connection states plus responsive mobile layout.
- Extended frontend, adapter and release-validation coverage for the new status behavior and layout.
- Kept the database schema and npm dependency tree unchanged apart from the SALTA root version.

## 0.8.14

- Added separate FRITZ!Box TR-064 protocol, host and port controls on the Presence page.
- Added explicit HTTP/HTTPS selection and both common TR-064 ports, 49000 and 49443, while preserving manually selected protocol/port combinations.
- Added an HTTPS-only **Disable certificate verification** option for local self-signed FRITZ!Box certificates.
- Scoped the certificate-verification bypass to FRITZ!Box HTTPS requests only; SALTA never changes `NODE_TLS_REJECT_UNAUTHORIZED` or global TLS behavior.
- Added a dedicated additive transport-settings table for the TLS option, keeping the canonical schema free of incremental `ALTER TABLE` migrations.
- Added a clear certificate-validation error and Presence-page guidance when HTTPS verification fails.
- Replaced the FRITZ!Box SOAP transport with Node.js request-scoped HTTP/HTTPS requests while retaining Digest authentication, timeouts and MAC-targeted `GetSpecificHostEntry`.
- Extended frontend, schema, transport and release-validation coverage for protocol/port selection and TLS behavior.
- Kept the npm dependency tree unchanged apart from the SALTA root version.

## 0.8.13

- Added a dedicated **Presence** page to the main desktop and mobile navigation.
- Added local FRITZ!Box TR-064 `Hosts:1` integration for MAC-based Wi-Fi presence without container-side ping or ARP scanning.
- Added encrypted optional FRITZ!Box credentials, connection testing, configurable polling and a global absence delay on the same page.
- Added persistent named presence targets with normalized MAC addresses and optional per-person absence-delay overrides.
- Added read-only SALTA presence devices with immediate arrival detection, delayed departure detection, last-seen metadata and gateway reachability.
- Added the virtual **Hauspräsenz** device with `anyHome`, `nobodyHome`, `present` and `presentCount`.
- Exposed individual and house-presence boolean states automatically as automation triggers and conditions.
- Preserved the last known presence state during FRITZ!Box communication failures to avoid false away events.
- Added schema, frontend, transport and release-validation coverage for the presence integration.
- Kept the npm dependency tree unchanged apart from the SALTA root version.

## 0.8.12

- Added support for the deCONZ/Phoscon virtual `Daylight` sensor (`PHDL00`) instead of filtering it out with non-ZHA virtual resources.
- Imported the Daylight resource as a SALTA light sensor with `daylight`, `dark`, sunrise, sunset and deCONZ solar-phase status.
- Added German device-card labels and readable solar-phase names for deCONZ daylight status codes.
- Added realtime WebSocket updates for Daylight state and status changes, including status-only Daylight events.
- Enabled `daylight` and `dark` automatically as boolean automation triggers and conditions without changing the automation database schema.
- Added adapter, frontend, automation and release-validation coverage for the Daylight integration.
- Kept the npm dependency tree unchanged apart from the SALTA root version.

## 0.8.11

- Added multi-event selection to every additional OR-linked button trigger, matching the primary trigger workflow.
- Grouped stored button-event definitions from the same additional device back into one compact editor block when editing an automation.
- Expanded grouped selections through the existing `automation_triggers` payload, requiring no database migration.
- Enforced the eight-trigger limit across both primary and additional multi-event selections and automatically hides the add-trigger control when the limit is reached.
- Standardized automation select and field-label typography for a more consistent device editor.
- Extended frontend and release-validation coverage for additional-trigger multi-event selection, grouping and payload expansion.
- Kept the npm dependency tree unchanged apart from the SALTA root version.

## 0.8.10

- Fixed the GitHub CI regressions in the v0.8.9 automation and Phoscon frontend tests.
- Updated the multi-event UI test to verify the explanatory hint in its actual HTML owner instead of `automation-ui.js`.
- Replaced the outdated exact additional-trigger payload assertion with behavioral AST/source checks that support the v0.8.9 merged event/device OR-trigger payload.
- Updated the Phoscon realtime test to verify the normalized `numberValue(...)` event path rather than the removed direct `typeof` check.
- Added release-validation guards that reject these three stale assertions if they are reintroduced.
- Retained the complete Aqara WebSocket/fallback handling and compact multi-event automation functionality from v0.8.9.
- Kept the npm dependency tree unchanged apart from the SALTA root version.

## 0.8.9

- Fixed Aqara/deCONZ button events not reaching automations when the deCONZ WebSocket port is unavailable from the SALTA container.
- Added button-only REST fallback polling while the WebSocket is disconnected; the fallback uses deCONZ `lastupdated` so repeated identical `buttonevent` values are recognized as new events.
- Added de-duplication between WebSocket and fallback delivery to prevent one physical press from executing twice.
- Added realtime Phoscon diagnostics showing WebSocket connectivity, fallback mode and the last received button event.
- Added compact multi-event selection for one button trigger, so e.g. single click OR double click can trigger the same automation without adding visible trigger rows.
- Kept the canonical database schema and npm dependency tree unchanged apart from the SALTA root version.

## 0.8.8

- Added up to eight OR-linked triggers per automation while keeping the first trigger editor unchanged for simple rules.
- Added compact, collapsed additional-trigger rows opened only when the user needs to edit them.
- Added searchable device, state and event selection to every additional trigger.
- Added the additive `automation_triggers` table without `ALTER TABLE`, preserving SALTA's canonical schema policy and existing v0.8.x automations.
- Extended cycle protection, target/condition validation and realtime button-event handling across every OR trigger.
- Kept automation cards compact by showing the first trigger plus a concise `N Auslöser (ODER)` indicator.
- Kept the npm dependency tree unchanged apart from the SALTA root version.

## 0.8.7

- Fixed the GitHub CI failure caused by the v0.8.6 automation-room implementation adding an incremental `ALTER TABLE` statement to SALTA's clean canonical schema.
- Moved automation room assignments into a new additive `automation_preferences` table instead of altering the existing `automations` table.
- Preserved room assignment, room badges, relative last-event labels and the aligned automation editor introduced in v0.8.6.
- Kept existing v0.8.x automation records upgrade-compatible: the new preference table is created automatically and existing rules remain unassigned until a room is selected.
- Strengthened schema and release validation so incremental `ALTER TABLE` migrations cannot be reintroduced.
- Kept the npm dependency tree unchanged apart from the SALTA root version.

## 0.8.6

- Realigned the Automations editor so search inputs, device selectors, trigger/value fields and action fields use consistent widths and spacing.
- Added an optional SALTA room assignment to automation rules, persisted with an additive `room_id` column that is cleared automatically when a room is deleted.
- Added room badges to automation cards and kept existing automations without a room fully compatible.
- Replaced the raw last-run timestamp with a relative German event label such as `Heute · 19:01 Uhr`, `Gestern · 08:45 Uhr` or `vor 3 Tagen · 21:07 Uhr`.
- Added API validation and regression coverage for automation room assignments while retaining all realtime deCONZ button-event functionality from v0.8.5.

## 0.8.5

- Added a persistent deCONZ/Phoscon WebSocket client with automatic reconnect and WebSocket-port discovery from gateway configuration.
- Imported `ZHASwitch` and `lumi.remote...` resources as dedicated Zigbee button devices instead of merging them into actuator cards.
- Added a dedicated SALTA device-event channel so repeated identical `buttonevent` values are delivered as separate events.
- Added button-event automation triggers while preserving the existing PostgreSQL automation schema and all v0.8.x rules.
- Added Aqara/deCONZ button-event choices and raw event-code labels in the automation editor.
- Kept the existing searchable trigger, condition and target device selectors.

## 0.8.4

- Fixed the automation frontend CI regression caused by a brittle exact CSS substring assertion for the mobile media query.
- Added media-query-aware CSS inspection helpers that locate selectors anywhere inside the requested media block instead of requiring them to be the first rule.
- Added regression coverage for shared mobile media queries containing multiple selectors before the automation card rules.
- Extended release validation so the fragile selector-adjacency assertion cannot be reintroduced.
- Retained the searchable trigger, condition and target device selectors from v0.8.3 without runtime or dependency changes.

## 0.8.3

- Added searchable trigger, condition and target device selectors to the Automations editor.
- Device search matches names, rooms, adapter/source labels, models and logical device types.
- Added match counts and deterministic room/name sorting so large installations are easier to navigate.
- Widened the automation editor on large screens while keeping the existing single-column responsive layout on smaller screens.
- Added regression coverage for all three searchable selectors without changing automation-engine behavior or npm dependencies.

## 0.8.2

- Removed the CI dependency on a standalone `vitest.config.ts` bootstrap file.
- `npm test` now runs through the existing test-symbol preflight runner, which supplies deterministic test-only configuration before launching the locked local Vitest executable.
- Preserved the database-independent automation core and injected PostgreSQL persistence introduced in v0.8.1.
- Added release checks that prevent the test runner from depending on optional Vitest root configuration files.
- Retained the v0.8.0 automation engine, optional device condition, and On/Off/Toggle target actions unchanged.


## 0.8.1

- Fixed the GitHub CI collection failure where the automation unit test imported `db.ts` and triggered production environment validation before Vitest could run.
- Separated the automation core from PostgreSQL persistence and system logging through injected `AutomationStore` and `AutomationLogger` interfaces.
- Added a production `automation-persistence.ts` adapter and explicit dependency injection from `main.ts`.
- Added a centralized Vitest setup for mandatory test-only application configuration values.
- Explicitly excluded the Vitest-only setup from the production TypeScript build.
- Added regression and release validation so the automation core cannot silently regain a direct database/configuration dependency.
- Retained the complete automation trigger, optional condition, On/Off/Toggle action, persistence and loop-protection functionality from v0.8.0.
- Kept the npm dependency tree unchanged from v0.8.0 apart from the SALTA root version.

## 0.8.0

- Introduced the first persistent local automation engine and re-baselined the roadmap so v0.8.x represents the automation milestone.
- Added an Automations page for device-state triggers, one optional device-state condition and On/Off/Toggle actions.
- Added transition detection so repeated adapter polling does not retrigger unchanged states.
- Added cross-adapter actions through the shared device command router, including Shelly, Zigbee, HomeMatic and virtual devices.
- Added rule enable/disable, edit, delete, last-run reporting and automation system-log entries.
- Added cyclic automation graph rejection and active-rule re-entry protection.
- Added an additive PostgreSQL `automations` table with foreign-key cleanup for deleted devices.
- Added authenticated, rate-limited automation CRUD endpoints and regression coverage for engine behavior, UI structure and schema persistence.
- Kept the npm dependency tree unchanged from v0.7.18 apart from the SALTA root version.

## 0.7.18

- Added a compact Shelly web-interface shortcut next to the configuration button on Shelly device cards.
- The shortcut opens the stored Shelly host in a separate browser tab and is available on both the Shelly page and room overview.
- Restricted generated device links to HTTP/HTTPS, rejected embedded URL credentials, and isolated the new tab with `noopener,noreferrer`.
- Added dedicated frontend regression tests and release validation for the Shelly-only shortcut and compact button layout.
- No database migration, environment-variable change or production dependency update is required.


## 0.7.17

- Fixed the virtual-device server test by importing the mocked `listRooms` database helper before use.
- Added a dedicated TypeScript test-symbol preflight that scans all test sources for unresolved identifiers before Vitest starts.
- Added `tsconfig.tests.json` so test files are included in the preflight even though production compilation intentionally excludes `*.test.ts`.
- Added release validation that requires the test-symbol preflight to remain part of `npm run check`.
- Retained all virtual-switch, HomeKit, compact-card, room-overview, security and dependency fixes from v0.7.16.


## 0.7.16

- Added a new **Virtual Devices** navigation section directly after HomeMatic.
- Added persistent SALTA-native virtual switches with create, rename, room assignment, control and delete workflows.
- Virtual switch state is stored through the existing PostgreSQL-backed device registry.
- Virtual switches are automatically exposed through the SALTA HomeKit bridge when HomeKit is enabled.
- Added a shared device command router so SALTA and HomeKit use the same source-aware command path.
- Added virtual-device API, UI and HomeKit regression coverage without changing the database schema.
- Retained the compact responsive device-card layout and hardened build tests from v0.7.14 and v0.7.15.

## 0.7.15

- Fixed five false-negative build tests introduced with the compact device-card layout.
- Replaced last-rule-only CSS assertions with shared rule inspection that recognizes both desktop declarations and later mobile media-query overrides.
- Added transitive TypeScript-AST call-graph inspection so OpenCCU tests follow `deviceCard` through the shared `deviceControls` renderer to thermostat controls.
- Added regression tests for override-aware CSS inspection, composed renderer calls and cyclic helper graphs.
- Extended release validation to prevent the obsolete test patterns from returning.
- Retained every compact and responsive device-card change from v0.7.14 without changing runtime behavior.
- No database migration or environment-variable change is required.

## 0.7.14

- Redesigned device cards with denser spacing, smaller headers and compact measurement chips.
- Moved the configure action into the card header so read-only sensor cards no longer render an otherwise empty bottom action row.
- Grouped dimmer, thermostat and window-covering controls in a compact control section while preserving all existing actions.
- Changed device grids to an adaptive layout that uses available desktop and tablet width more efficiently.
- Added a dedicated mobile layout with single-column device cards, reduced padding and a compact two-by-two summary grid.
- Kept the room-grouped overview behavior unchanged: only devices with a valid room assignment are displayed.
- Added AST and responsive-layout regression coverage for control composition, configuration placement and empty-action suppression.
- No database migration or environment-variable change is required.

## 0.7.13

- Fixed the overview page so devices with valid room assignments are reliably displayed in their configured room.
- Added normalized room-ID matching to handle UUID formatting differences safely.
- Added a unique room-name fallback for legacy device records and adapter refreshes that retain a room name without a usable room UUID.
- Kept devices without a valid, unambiguous room assignment completely hidden from the overview page.
- Added a dedicated browser room-grouping helper with behavior-based regression tests for assigned, legacy, stale, ambiguous and unassigned devices.
- Added explicit overview DOM initialization and release validation that guarantees the grouping helper loads before the main application script.
- Disabled browser caching for SALTA-owned HTML, JavaScript and CSS assets so a new page can no longer run with an older cached application script after an upgrade; immutable bundled vendor assets remain long-lived.
- Extended the complete quality gate to syntax-check both browser scripts.
- No database migration or environment-variable change is required.

## 0.7.12

- Fixed the false-negative OpenCCU frontend test that still required the obsolete exact call `targetTemperatureControl(d)` after the renderer added an instance argument for duplicate-ID protection.
- Replaced critical exact frontend call-string assertions with TypeScript-AST source contracts that validate function existence and call relationships independently of formatting and additional compatible arguments.
- Added a release validator for root-version consistency, public npm registry URLs, pinned security overrides, and the Homebridge DBus tarball checksum.
- Added a safe `npm run version:set -- <version>` command that updates only SALTA root version fields and known release surfaces without modifying transitive dependency versions or integrity values.
- Expanded `npm run check` to include release validation and browser JavaScript syntax validation.
- Changed the Docker build to run the complete quality gate instead of only compiling TypeScript.
- Added an explicit verification job to the release workflow before QEMU and multi-architecture image publication.
- No application runtime behavior, database schema, environment variable, device integration, room overview, or thermostat control behavior changed.

## 0.7.11

- Replaced the overview page's static **STATUS / Alles an einem Ort** panel with live device cards grouped by room.
- Shows all Shelly, Zigbee and HomeMatic devices that have a valid room assignment.
- Preserves the room order configured on the Rooms page and omits unassigned or stale room references from the overview.
- Keeps device controls, live values, thermostat modes, dimmers and window-covering controls available directly on the overview cards.
- Displays the source system on mixed overview cards so Shelly, Zigbee and HomeMatic devices remain distinguishable.
- Added frontend regression coverage for overview grouping, removal of the old status panel and live rendering integration.
- No database migration or environment-variable change is required.

## 0.7.10

- Made an already displayed HomeMatic thermostat control mode directly writable in the web interface.
- Added a safe fallback for OpenCCU installations that expose read-only `CONTROL_MODE` but omit the writable mode parameter from `getParamsetDescription`.
- Uses native `AUTO_MODE` / `MANU_MODE` actions for classic HomeMatic thermostats and `SET_POINT_MODE` values 0 / 1 for Homematic IP thermostats.
- Allows existing synchronized thermostat records to use the inferred command path immediately and persists complete metadata after synchronization.
- Added runtime and regression coverage for classic HomeMatic and Homematic IP wall thermostats.
- Retained the `find-my-way` 9.7.0 security fix and the corrected `@homebridge/dbus-native` 0.7.7 lock entry.
- No database migration or environment-variable change is required.

## 0.7.9

- Fixed the reproducible `npm ci` build failure caused by mismatched `@homebridge/dbus-native` version and integrity metadata in `package-lock.json`.
- Restored the upstream `@homebridge/dbus-native` 0.7.7 package record, tarball URL and matching SHA-512 integrity value.
- Added an exact npm override for `@homebridge/dbus-native` 0.7.7 so future lockfile refreshes cannot accidentally select the problematic 0.7.8 record.
- Added regression coverage that verifies the dependency version, resolved tarball, integrity checksum and `@homebridge/hap-nodejs` dependency declaration remain consistent.
- Retained the HomeMatic thermostat mode controls introduced in v0.7.8 and the `find-my-way` 9.7.0 security fix.
- No database migration or environment-variable change is required.

## 0.7.8

- Added HomeMatic thermostat operating-mode controls for **Off**, **Manual** and **Automatic**.
- Supports classic HomeMatic thermostats and wall thermostats exposing `AUTO_MODE` / `MANU_MODE` actions.
- Supports Homematic IP thermostats and wall thermostats exposing a writable mode enum such as `SET_POINT_MODE`.
- Uses OpenCCU parameter descriptions to select the correct native value type and mode values instead of relying on device-model hardcoding.
- Implements **Off** through a native off mode when available, otherwise through manual mode at the device's minimum frost-protection temperature.
- Added active-state mode buttons to HomeMatic thermostat cards and regression coverage for both thermostat families.
- No database migration or environment-variable change is required.

## 0.7.7

- Updated the transitive Fastify router dependency `find-my-way` from 9.6.0 to 9.7.0.
- Fixed CVE-2026-47219 / GHSA-c96f-x56v-gq3h, a remotely triggerable denial-of-service condition when `find-my-way` is used with Node.js HTTP/2.
- Added an exact npm override so `npm ci` and Docker builds reproducibly install the patched router release.
- Added regression coverage that rejects vulnerable `find-my-way` versions in `package-lock.json`.
- Kept application behavior, APIs, database schema, environment variables and device integrations unchanged.

## 0.7.6

- Updated the window-covering slider regression test for the shared live-refresh guard introduced with thermostat target-temperature control.
- Verifies that active cover, brightness and target-temperature sliders are all protected from periodic device-card re-rendering.
- Keeps runtime behavior, OpenCCU control, database schema and deployment configuration unchanged.

## 0.7.5

- Reads ReGa device IDs through `Device.listAll`, resolves each physical device through `Device.get`, and joins its configured name to the RPC catalogue by address.
- Keeps distinct OpenCCU channel names as secondary card metadata for multi-channel devices.
- Refreshes VALUES parameter descriptions to identify writable parameters and their native JSON-RPC value types.
- Corrected HomeMatic command value types from guessed `boolean`/`double` values to the OpenCCU-compatible `bool`/`float` types.
- Added target-temperature control for compatible classic HomeMatic and HomeMatic IP radiator and wall thermostats.
- Continues to keep contact, motion and other pure sensor channels read-only.
- Added regression coverage for physical device names, thermostat mapping, control metadata and frontend temperature controls.

## 0.7.4

- Added automatic OpenCCU recovery after gateway restarts and temporary network outages.
- Invalidates stale local JSON-RPC sessions after transport, catalogue or complete channel-read failures and creates a fresh session on the next retry.
- Retries disconnected OpenCCU gateways every 15 seconds while keeping the normal connected polling interval at 60 seconds.
- Refreshes the OpenCCU device catalogue after reconnecting so current device and channel names are loaded again.
- Reads names from `Device.listAllDetail` from both array and keyed-object response shapes and decodes URL-encoded names.
- Replaces legacy generated names such as `HM-Sec-SCo NEQ1157537:1` with the configured OpenCCU name.
- Continues to preserve names that were deliberately edited locally in SALTA.
- Reduced the error-501 automatic retry delay to one minute while retaining serialized, single-session access.
- Added regression coverage for gateway restart recovery, legacy-name replacement and locally customized names.

## 0.7.0

- Added a native OpenCCU/HomeMatic JSON-RPC integration.
- Added separate HomeMatic navigation, filtering and device cards.
- Added encrypted OpenCCU account configuration under Settings.
- Added periodic synchronization for BidCos-RF, BidCos-Wired, HmIP-RF and VirtualDevices.
- Added control for compatible switches, dimmers and window coverings plus read-only sensor mapping.
- Added additive OpenCCU settings and per-device adapter metadata storage.
- Added OpenCCU core, persistence, frontend and API regression coverage.

## 0.6.3

- Fixed two frontend regression tests that still expected the pre-visibility device configuration payload.
- Updated the assertions to validate the shared configuration object and its serialized request body.
- Preserved the Zigbee `hidden` preference added conditionally for Phoscon devices.
- Kept application runtime behavior, APIs, database schema and deployment configuration unchanged.

## 0.6.2

- Hid Shelly-only credential controls correctly in Zigbee device dialogs.
- Added a persistent local visibility setting for Zigbee devices.
- Kept hidden Zigbee devices visible as grey cards with an explicit status badge.
- Excluded hidden devices from HomeKit synchronization, including dynamic removal of an existing accessory.
- Added an additive `device_preferences` table that is created automatically without a database reset.
- Preserved visibility choices across Phoscon synchronization and gateway reconnects.
- Added API, persistence, HomeKit and frontend regression coverage.

## 0.6.1

- Fixed the Phoscon adapter test suite importing the production database configuration during module collection.
- Moved URL normalization, REST response parsing and Zigbee device mapping into a configuration-free Phoscon core module.
- Kept database persistence and runtime polling isolated in the production adapter.
- Added regression coverage through imports that no longer require `DATABASE_URL`, administrator credentials or SALTA secrets.
- Kept Phoscon behavior, APIs, database schema and deployment configuration unchanged.

## 0.6.0

- Added a local Phoscon/deCONZ REST API integration with encrypted API-key storage.
- Added guided Phoscon app pairing after enabling gateway authorization.
- Split the former Devices navigation into dedicated Shelly and Zigbee pages.
- Added Zigbee light, outlet, covering, sensor and metering discovery and synchronization.
- Combined multiple deCONZ sensor resources belonging to one physical Zigbee device.
- Merged unambiguous metering and battery sensor resources into their matching actuator card.
- Added control for supported Zigbee on/off devices, dimmable lights and window coverings.
- Added Phoscon connection state, manual synchronization and disconnect controls.
- Extended credential-readiness validation and rate limiting to the Phoscon adapter.
- Added adapter, API and frontend regression coverage.

## 0.5.7

- Added practical hardware guidance for a dedicated SALTA-only host.
- Recommended a Raspberry Pi 4 with 4 GB RAM and SSD storage while documenting lower practical minimums.
- Made installation, reset, update, backup and security wording in the README independent of a specific release line.
- Removed obsolete migration wording and hard-coded release references from the README.
- Kept application runtime behavior, APIs, database schema and deployment configuration unchanged.

## 0.5.6

- Expanded `docker-compose.image.yml` into a complete standalone production deployment.
- Included PostgreSQL, SALTA, volumes, networks, health checks, security options, port mappings and all required environment variables in the single file.
- Updated installation, update, backup, restore and production documentation commands to use only `docker-compose.image.yml`.
- Added regression coverage that verifies the production Compose file is self-contained.
- Kept the database schema and application runtime behavior unchanged.

## 0.5.5

- Fixed backup and restore scripts so `.env` values containing spaces are no longer executed as shell code.
- Added registry hydration that loads persisted devices without rewriting them at every startup.
- Cleared in-memory room assignments immediately after a room is deleted.
- Removed legacy automatic room creation from device persistence.
- Removed unreachable thermostat and motion-sensor presentation paths.
- Removed unused exports, metadata keywords and the redundant direct Pino dependency.
- Enabled TypeScript unused-local and unused-parameter checks and excluded test sources from the production build output.
- Marked the package as private and removed the duplicate release-notes file.

## 0.5.4

- Corrected the security documentation to match the implemented v0.5 behavior.
- Clarified that SALTA does not terminate TLS and that direct LAN HTTP traffic is unencrypted.
- Documented the exact `TRUSTED_PROXIES`, HTTPS detection, Secure-cookie and HSTS behavior.
- Documented that direct Basic authentication is limited to `LOCAL_NETWORKS`, rejected through forwarded proxy requests and should be protected by HTTPS.
- Clarified that application rate limits, sessions and login blocks are stored in process memory and reset on restart.
- Corrected the Docker description of `/tmp` to writable, size-limited `tmpfs` with `noexec` and `nosuid`; the container root filesystem is not read-only.
- Added narrower local-network guidance and security-control limitations without changing runtime behavior or the database schema.

## 0.5.3

- Fixed the Shelly onboarding dialog closing after an upstream device authentication failure.
- Redirected to the SALTA login page only for the explicit `UNAUTHORIZED` session error.
- Returned Shelly credential failures as HTTP 422 instead of HTTP 401.
- Kept authentication errors visible inside the open onboarding dialog.
- Added frontend and API regression coverage for the corrected authentication paths.
- Kept the v0.5 database schema and installation configuration unchanged.

## 0.5.2

- Restored the complete Material Design Icons (MDI) attribution in `README.md`.
- Added the upstream Pictogrammers attribution required by the frontend regression test.
- Retained the Apache License 2.0 notice and local bundled-license reference.
- Kept runtime behavior, APIs and the v0.5 database schema unchanged.

## 0.5.1

- Fixed the npm lockfile after the v0.5.0 dependency cleanup removed two still-required nested packages.
- Restored `fast-uri@4.1.1` for `fast-json-stringify`.
- Restored `process-warning@4.0.1` for `light-my-request`.
- Restored registry URL and integrity metadata for `@fastify/rate-limit@10.3.0`.
- Kept the v0.5 clean-install architecture and runtime behavior unchanged.

## 0.5.0

- Introduced a clean-install-only database schema generation with explicit schema metadata.
- Added one-step installation with `./install.sh`, database reset with `--reset` and complete reinstall with `--fresh`.
- Added automatic generation of PostgreSQL, administrator, health-token and encryption secrets.
- Removed incremental SQL migrations, the duplicate room-name column and old room synchronization logic.
- Removed v1 credential decryption and automatic credential conversion.
- Removed compatibility mutation logic from `update.sh`, the old `deploy.sh` workflow and the obsolete v0.3 roadmap.
- Replaced the direct static-file plugin with an allow-listed native handler and removed its obsolete `glob` dependency chain.
- Added regression tests for mandatory Compose variables, fresh installation, static assets and the canonical v0.5 schema.
- Documented the remaining deprecated transitive `q` package inherited from the upstream HomeKit persistence dependency.
- Updated Compose, environment examples and documentation for clean v0.5 installations.

## 0.4.33

- Changed the SALTA source-code license from MIT to Apache License 2.0.
- Updated `LICENSE`, package metadata and README licensing information consistently.
- Removed version-tag publishing instructions from the main README.
- Added release documentation and Git commands for v0.4.33.
- Added no runtime, database or configuration changes.

## 0.4.32

- Added `@fastify/rate-limit` and explicit per-route limits for all six database- or authentication-backed endpoints reported by CodeQL.
- Retained the existing SALTA global, client, mutation and specialized rate limits as defense in depth.
- Replaced the Digest challenge regular expression with a linear character-by-character parser.
- Added regression coverage for route rate-limit configuration and Digest challenge parsing.

## 0.4.31

- Updated the persistent-theme regression test for the CSP-compatible external `theme-init.js` script.
- Verified that theme initialization runs before the first stylesheet is loaded.
- Kept runtime behavior and security policy unchanged.

## 0.4.30

- Republished the unchanged v0.4.29 application and security hardening under a new release tag.
- Added no runtime, database or configuration changes.
- Intended to trigger a fresh GitHub container build when the previous workflow run cannot be rerun.

## 0.4.29

- Fixed TypeScript compilation of the authenticated Fastify injection test helper.
- Replaced overload-derived `undefined` options with `light-my-request` `InjectOptions`.
- Added `light-my-request` as an explicit development dependency.
- Kept the v0.4.28 security behavior unchanged.

## 0.4.28

- Added mandatory browser authentication with a dedicated login page and server-side sessions.
- Added HttpOnly SameSite=Strict cookies, CSRF validation, logout and finite session lifetimes.
- Restricted direct HTTP Basic API access to configured local networks.
- Protected health and readiness endpoints and added a secret Docker-only health check.
- Added login, per-client, mutation, expensive-route and global request limits with security logging.
- Added CSP and additional browser security headers, body/header limits and connection timeouts.
- Moved PostgreSQL to an internal Docker network and removed its published host port.
- Added Docker capability, PID and temporary-filesystem restrictions for SALTA.
- Added automated security, session, CSRF, local-network and frontend authentication coverage.
- Added `SECURITY.md` and reverse-proxy trust guidance.

## 0.4.26

- Updated the compact device-card regression test to match the current 11 px/10 px measurement spacing.
- Restored successful CI and release builds after the v0.4.25 layout adjustment.
- No runtime or database behavior changed.

## 0.4.25

- Moved the device name into the top row beside the device icon.
- Kept the room/type metadata directly below the title inside the same compact header block.
- Reduced top whitespace in device cards.
- Added frontend regression coverage for the compact device-title layout.

## 0.4.24

- Extended colored state-card styling to outlet devices such as Shelly Plug S (`SHPLG-S`).
- Softened the outer state-card border colors so the right edge is less visually heavy.
- Removed the redundant On/Off status metric from colored outlet cards.
- Added frontend regression coverage for outlet state coloring.

## 0.4.23

- Added green and red card-state colors for reachable switch and light devices.
- Removed the redundant On/Off status metric from colored switch and light cards.
- Kept the compact device-card layout and compact measurement presentation.
- Added frontend regression coverage for state-color card styling.

## 0.4.22

- Grouped the device overview by room.
- Applied the persistent room order from the Rooms page to device groups and room selectors.
- Added accessible up/down controls for arranging rooms.
- Added a transactional room-order API and normalized stored sort positions.
- Replaced the device-card Configure text button with a compact gear-only button.
- Kept unassigned devices in a final dedicated group.
- Added API and frontend regression coverage for grouping, ordering and the icon-only configuration action.

## 0.4.21

- Reduced padding and vertical spacing inside device cards.
- Prevented short cards from stretching to the height of the tallest card in the same grid row.
- Compacted measurement rows, action buttons and cover-position controls.
- Added frontend regression coverage for compact card layout.

## 0.4.20

- Replaced free-text room icon entry with a curated visual icon selector.
- Added common room choices such as living room, bedroom, kitchen, bathroom, office, garage and garden.
- Added live icon previews for new and existing rooms.
- Synchronized renamed room names into every assigned device in memory and PostgreSQL.
- Added frontend, registry and API regression coverage for room icon selection and room-name synchronization.

## 0.4.19

- Removed hover elevation and shadow transitions from device cards.
- Added subtle hover and active feedback to buttons and button-style links only.
- Added frontend regression coverage to keep device cards visually stable during live refreshes.

## 0.4.18

- Replaced custom and Unicode interface symbols with locally bundled Material Design Icons.
- Added local MDI webfont assets without external CDN requests.
- Added MDI device, navigation, theme, action and room icons.
- Documented the Pictogrammers source and Apache License 2.0 attribution.
- Added frontend regression coverage for local icon loading and licensing.

## 0.4.17

- Added a configurable logical device function for compatible on/off Shelly devices.
- Added Automatic, Light, Switch, Outlet and Fan presentation options to the shared device configuration dialog.
- Kept physical Shelly detection and command routing separate from user-selected dashboard and HomeKit presentation.
- Added HomeKit `Lightbulb`, `Switch`, `Outlet` and `Fanv2` service mappings.
- Added automatic HomeKit service rebuilding when a device function changes.
- Persisted the selected function through the automatic `presentation_type` database schema extension.
- Preserved configured functions during Shelly status refreshes and repeated onboarding.
- Rejected incompatible presentation assignments for non-switchable devices.
- Added automated frontend, API, adapter, persistence and HomeKit regression coverage.

## 0.4.16

- Added a live light/dark theme switch to the sidebar.
- Added a complete dark palette for dashboards, device cards, dialogs, forms, navigation and mobile controls.
- Persisted the selected appearance in the functional `salta_theme` cookie for one year.
- Applied the saved theme before the stylesheet renders to prevent a visible light-theme flash.
- Updated the browser theme color and native control color scheme when the theme changes.
- Added accessible labels, pressed state and reduced-motion handling for the theme control.
- Added automated frontend regression coverage for theme persistence and dark-mode styling.

## 0.4.15

- Added a 0–100 percent position slider to calibrated window-covering device cards.
- Added immediate position previews and percentage feedback while dragging the slider.
- Preserved active slider interaction during the five-second live-status refresh.
- Added discrete Open, Stop and Close actions for window coverings.
- Displayed clear calibration guidance when a Shelly cannot report a current position.
- Added adapter-side validation for cover target positions.
- Added automated frontend and adapter regression coverage for position control.

## 0.4.14

- Added active `switch` and `cover` profile detection for Shelly 2PM-class devices.
- Added `Shelly.GetConfig` retrieval for component configuration and channel names.
- Registered every switch component as an independent SALTA device in switch profile.
- Registered one unified window-covering device in cover profile.
- Routed live state refreshes and commands to the matching component ID.
- Persisted the detected device profile through an automatic database schema extension.
- Preserved existing primary-device names and room assignments when a multi-channel device is added again without replacement values.
- Added channel metadata to device cards and channel-aware onboarding feedback.
- Added regression coverage for two-channel onboarding, cover onboarding and second-channel commands.

## 0.4.13

- Improved Gen2, Gen3 and Gen4 onboarding through the public `/shelly` identity endpoint.
- Changed parameterless RPC status detection to a compatible HTTP GET request.
- Added a JSON-RPC frame fallback for firmware that rejects method-specific GET endpoints.
- Added RFC 7616 Digest authentication with SHA-256 support for protected Gen2+ devices.
- Preserved Basic authentication support for Gen1 devices.
- Prevented a confirmed Gen2+ device from being misreported as an unsupported Gen1 endpoint after a status-call failure.
- Added detailed rejected-onboarding errors to the structured server log.
- Added Shelly Plus 2PM regression coverage for two switch channels, Digest authentication and RPC fallback behavior.

## 0.4.11

- Fixed room-name editing being cancelled by the five-second live refresh.
- Separated live device polling from the full rooms and filters refresh.
- Preserved active room edit drafts, focus and text selection during intentional full page-data refreshes.
- Added frontend regression coverage for room editing and live polling.

## 0.4.10

- Corrected Gen1 Shelly 1 (`SHSW-1`) capability detection.
- Stopped treating the Shelly 1 user-configured nominal load as a live power measurement.
- Marked `SHSW-1` devices as not supporting hardware power metering.
- Kept real Shelly 1PM (`SHSW-PM`) power and energy measurements unchanged.
- Removed misleading `0 W` values from Shelly 1 device cards and the dashboard power total.
- Added automated regression coverage for Shelly 1 and Shelly 1PM Gen1 status parsing.

## 0.4.9

- Added startup and readiness validation for encrypted global and per-device Shelly credentials.
- Added a clear `ENCRYPTION_KEY_MISMATCH` API response instead of exposing a generic persistence error.
- Disabled the global-credentials onboarding option when stored credentials cannot be decrypted and displayed a corrective warning in the web interface.
- Upgraded new credential encryption to AES-256-GCM with a per-secret random salt and a `scrypt`-derived key.
- Added backward-compatible decryption and automatic re-encryption of valid legacy v1 secrets.
- Updated `deploy.sh` to generate a random 256-bit `SALTA_ENCRYPTION_KEY` for new installations.
- Preferred dedicated `PM1`/`EM1` measurement components over stale zero values from switch components.
- Added fallback support when a device exposes a single metering component with a different component ID.
- Added automated tests for encryption compatibility, key mismatch handling and power-meter selection.

## 0.4.7

- Added a device removal action to the Shelly device configuration dialog.
- Added `DELETE /api/devices/:id` for persistent Shelly device removal.
- Device removal now deletes associated command history through the existing database cascade.
- Removed devices are immediately detached from the in-memory registry and HomeKit bridge.
- Added race protection so an active Shelly status refresh cannot recreate a device while it is being removed.
- Added automated tests for persistent removal, stale refresh protection and deliberate re-adding.

## 0.4.6

- Added `docker-compose.image.yml` as the single production image override.
- Removed the architecture-specific `docker-compose.arm64.yml` and `docker-compose.amd64.yml` files.
- Relied on the GHCR multi-architecture manifest for automatic host architecture selection.
- Updated deploy, update, backup and restore scripts to use the unified image Compose configuration.
- Updated README, GHCR documentation, release notes and release commands for v0.4.6.

## 0.4.5

- Corrected Shelly device type detection for covers, lights, outlets, switches and dedicated energy meters.
- Prioritized cover and light components before generic switch components during RPC detection.
- Added outlet classification for Shelly Plug, Plug S and PowerStrip model families.
- Added support for separate `PM1`, `EM1` and `EM` measurement components.
- Added aggregation of multi-channel and multi-phase power and energy values.
- Displayed current power, energy, voltage, current, frequency and temperature values with appropriate units.
- Prevented unavailable measurements from being displayed as artificial zero values.
- Updated persisted device types during status synchronization when improved detection returns a different type.
- Rebuilt HomeKit accessories with the correct service after a detected device type change.
- Used detected Shelly component kinds and IDs for RPC control commands.
- Added automated parser tests for Gen1 and Gen2+ device detection and live values.
- Updated release documentation and GHCR publishing instructions for v0.4.5.

## 0.4.2

- Redesigned the Shelly onboarding dialog with clearly separated connection and authentication sections.
- Replaced the crowded authentication dropdown with descriptive radio choices and conditional credential fields.
- Added responsive, consistent dialog layouts for Shelly onboarding and device configuration.
- Improved network discovery feedback and disabled action buttons while requests are running.
- Added clearer helper text, spacing, focus behavior and accessible tab state.

## 0.4.1

- Removed the mock adapter and built-in demonstration devices.
- Added automatic cleanup of previously persisted mock devices.
- Removed mock-specific configuration and API endpoints.
- Updated HomeKit and synchronization routing to use Shelly only.

## 0.4.0

- Added Shelly discovery, manual device onboarding and device control foundations.
- Added support for Shelly Gen1 REST and Gen2/Gen3/Gen4 RPC devices.
