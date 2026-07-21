# SALTA v0.4.12

SALTA v0.4.12 adds display-name editing for all registered devices, including Shelly 3EM energy meters.

## Added

- A required **Display name** field in the device configuration dialog.
- Name editing for switches, outlets, lights, covers and energy meters.
- Automatic HomeKit accessory refresh when a device is renamed.

## Fixed

- Shelly 3EM devices no longer remain locked to the automatically detected device name.
- Leading and trailing whitespace is removed before a name is stored.
- Empty names are rejected by both the web interface and API validation.

## Compatibility

No database migration is required. Existing device records can be renamed immediately after updating.

## Quality assurance

The release passes TypeScript strict checking, 31 automated tests, frontend JavaScript syntax validation and the production build.
