# SALTA v0.8.10

SALTA v0.8.10 fixes the GitHub CI test regressions found after v0.8.9. The Aqara/deCONZ realtime fixes and compact multi-event automation functionality from v0.8.9 remain unchanged.

## CI test fixes

- Fixed `frontend-automations.test.ts` incorrectly looking for the text **Mehrere Ereignisse werden ODER-verknüpft** in `automation-ui.js`.
- The explanatory text is static UI markup and is now correctly verified in `public/index.html`.
- Removed the obsolete assertion that required the exact pre-v0.8.9 payload string `additionalTriggers:automationAdditionalTriggerPayload()`.
- The automation payload test now verifies that `automationPayload()` actually calls `automationAdditionalTriggerPayload()` and contains the merged `additionalTriggers` / `sameDeviceEventTriggers` path used for multi-event button triggers.
- Updated the Phoscon realtime test after v0.8.9 normalized button values through `numberValue(...)`.
- The test now verifies the normalized `eventValue` path and its emission guard instead of expecting the removed direct `typeof statePatch.buttonEvent === "number"` check.

## Regression hardening

- Release validation now rejects the stale HTML-vs-JavaScript multi-event hint assertion.
- Release validation rejects the obsolete pre-multi-event exact payload assertion.
- Release validation rejects the obsolete direct `typeof statePatch.buttonEvent` assertion.
- The runtime implementation was not weakened to satisfy tests; the tests were brought back in line with the current architecture.

## Aqara / deCONZ reliability retained from v0.8.9

- The deCONZ WebSocket remains the preferred realtime path.
- Numeric and string deCONZ sensor resource IDs remain normalized.
- Aqara button resources retain their `buttonevent` and `lastupdated` revision metadata.
- When the WebSocket is unavailable, SALTA keeps the button-only two-second fallback active.
- The fallback compares `lastupdated`, allowing repeated identical `buttonevent` values to be recognized as separate presses.
- WebSocket and fallback events remain de-duplicated.
- Realtime Phoscon status continues to show WebSocket connection, fallback mode and the latest button event.

## Multi-event automations retained from v0.8.9

- One Aqara/button trigger can match several selected deCONZ events.
- The selected event values are OR-linked.
- Multi-event selections share the existing v0.8.8 OR-trigger persistence model.
- Additional trigger devices remain supported.
- The total trigger limit remains eight definitions per automation.
- Existing single-event and single-trigger automations remain compatible.

## Existing automation functionality retained

- Multiple trigger devices remain OR-linked.
- Optional **Only if** conditions remain available.
- Target actions remain **On**, **Off** and **Toggle**.
- Searchable device selectors remain available.
- Automation room assignment remains available.
- Last successful execution remains displayed as **Heute**, **Gestern** or **vor X Tagen** with local time.
- Cross-system automation remains supported across Shelly, Zigbee, HomeMatic and SALTA virtual devices.

## Database and compatibility

- No database migration is required.
- No `ALTER TABLE` migration is introduced.
- No fresh PostgreSQL volume is required.
- No new environment variables are required.
- Existing v0.8.x configuration and automations remain compatible.

## Security and dependency status

- No production npm dependency was added or changed in v0.8.10.
- The transitive dependency tree remains unchanged from v0.8.9 apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7.
- Retains the patched `fast-uri` dependency versions.
- Retains PostCSS 8.5.20.
- Retains TypeScript 5.9.3 from the lockfile.

## Verification

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run validate:release
npm run typecheck
npm run test:preflight
npm test
npm run build
npm run check
sh -n install.sh update.sh backup.sh restore.sh
```

## Container tags

```text
0.8.10
0.8
latest
```

## Git tag

```text
v0.8.10
```
