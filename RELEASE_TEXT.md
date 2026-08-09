# SALTA v0.8.11

SALTA v0.8.11 extends the compact automation editor so every additional OR-linked button trigger can select multiple deCONZ/Aqara button events, while also making the automation form typography more consistent.

## Multi-event OR triggers

- Added the same multi-event checkbox picker used by the primary button trigger to every additional OR trigger.
- A second or later button device can now match several `buttonEvent` values, for example single click OR double click, without creating multiple visible device rows.
- Selected events are still persisted as normal OR-trigger definitions, so the existing automation database schema and engine remain unchanged.
- Existing stored button-event triggers from the same additional device are grouped back into one compact editor block when an automation is opened for editing.
- The collapsed OR-trigger summary now shows the device together with either the selected event or the number of selected events.
- The existing global maximum of eight trigger definitions per automation is enforced across primary and additional multi-event selections.
- The add-trigger control is disabled automatically once the eight-trigger limit has been reached.

## Automation editor consistency

- Standardized automation select typography to a consistent 13 px regular-weight presentation.
- Standardized device and trigger/value field labels to a quieter 11.5 px semi-bold presentation.
- Kept additional OR-trigger blocks compact and collapsed until they are opened for editing.
- Retained the same searchable device picker, matching-device counter, field heights and spacing for primary and additional trigger devices.

## Regression coverage

- Extended the automation frontend tests to require multi-event selection on additional OR triggers.
- Added coverage for grouping stored additional button events and expanding them through the existing OR-trigger payload.
- Added checks for the standardized automation field typography.
- Extended release validation so the additional-trigger multi-event UI and payload path cannot be removed accidentally.

## Compatibility

- No database migration is required.
- No `ALTER TABLE` migration is introduced.
- No fresh PostgreSQL volume is required.
- No new environment variables are required.
- Existing v0.8.x automations remain compatible.
- Existing single-event, multi-event primary-trigger and multiple-device OR automations remain compatible.

## Security and dependencies

- No production npm dependency was added or intentionally changed in v0.8.11.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7.

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
0.8.11
0.8
latest
```

## Git tag

```text
v0.8.11
```
