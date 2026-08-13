# SALTA v0.8.33

SALTA v0.8.33 makes the new global heating and battery controls visually consistent with the compact SALTA Overview and hardens the release quality gate against the brittle source-string assertions that caused several recent CI failures.

## Compact Overview system controls

- Reworked the **Heizmodus** and **Batterien** cards to use the same compact visual language as the rest of the SALTA Overview.
- Reduced card padding, title size, icon size and vertical spacing.
- Added a compact **Nur SALTA** badge to the heating card instead of relying on a long explanatory paragraph.
- The heating control remains explicitly excluded from HomeKit through a stable UI contract (`data-homekit-exposed="false"`).
- Summer and Winter remain a two-part segmented control.
- Winter operation now sits beside the mode control on larger screens and stacks cleanly on smaller screens.
- Thermostat status is rendered as compact chips for supported count, last application and success/failure result.
- The battery card now uses a compact status row and moves the Pushover action into the card header.
- Battery warnings show up to two affected devices inline and summarize any additional warnings instead of increasing the card height.
- The configured battery threshold is shown in the healthy status text.
- Both cards retain responsive single-column behavior on smaller screens.

## More robust frontend regression tests

- Replaced fragile exact object-literal checks for the shared device configuration payload with TypeScript AST inspection.
- Device configuration tests now verify the actual object-property contract (`name`, room, presentation and HomeKit settings) without depending on property adjacency or minified source formatting.
- The climate control test now verifies the HTML button bindings where they are owned and the JavaScript API call inside `applyClimateMode()` through AST inspection.
- Extended the shared source-inspection helper with string-argument call inspection and object-literal property inspection.
- Added a release-validation guard that rejects new frontend tests which compare complete object literals or exact function declarations as raw source strings.
- Consolidated the old standalone device-name and device-presentation tests into the shared device-dialog contract test, removing duplicate coverage while keeping the behavior checks.

## Leaner release quality gate

- `npm run check` no longer runs a separate production `typecheck` immediately before `npm run build`; the production build already performs the same TypeScript type checking.
- The optimized check pipeline now runs:
  1. release validation
  2. test-symbol preflight
  3. browser JavaScript syntax checks
  4. one production TypeScript build
  5. Vitest without repeating the preflight
- Added a dedicated `test:vitest` phase for the CI/release pipeline while keeping standalone `npm test` behavior unchanged.
- Moved test-only source/style inspection helpers from `src/test-utils` to top-level `test-utils` so they are no longer compiled into the production `dist` tree.
- Removed historical release-validator checks that inspected the internal implementation of individual test files. Test discovery and Vitest are now responsible for regression coverage; release validation focuses on release, security and stable application contracts.
- The test-symbol preflight remains in place to catch unresolved identifiers before Vitest starts.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No runtime API or persistence format is changed.
- Summer/Winter thermostat behavior is unchanged.
- The global heating mode remains excluded from HomeKit.
- Battery monitoring, encrypted Pushover settings and the persistent seven-day battery-warning cooldown remain unchanged.
- Existing HomeKit, Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, FRITZ!Box Presence, Daylight, virtual-device and automation functionality remains compatible.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.33.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains patched `fast-uri` `3.1.5` and `4.1.2`.
- Retains PostCSS `8.5.23`.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.33
0.8
latest
```

## Git tag

```text
v0.8.33
```
