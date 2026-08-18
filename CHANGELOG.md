# Changelog

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
