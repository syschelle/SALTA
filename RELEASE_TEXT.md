# SALTA v0.8.39

SALTA v0.8.39 changes device energy totals from Wh to kWh in the web interface while keeping the raw device state and APIs unchanged.

## Energy display

- Device values labeled **Energie** are now displayed in **kWh** instead of Wh.
- The conversion is presentation-only: SALTA continues to store and transport the original Wh value internally.
- Values are shown with up to three decimal places so smaller totals remain useful.
- Example: `3245.3 Wh` is displayed as `3.245 kWh`.
- The separate **Verbrauch** value remains displayed in Wh.
- The change applies consistently to every device source that exposes the standard SALTA `energy` state, including supported Shelly, Zigbee/Phoscon and OpenCCU/HomeMatic devices.

## Regression coverage

- Extended the existing device-card frontend test instead of creating another standalone suite.
- Added behavioral checks for Wh-to-kWh conversion.
- Added a regression check that the separate `consumption` state continues to use Wh.
- The test uses the existing AST source inspector and evaluates the formatter behavior without exact full-function source matching.

## Compatibility

- No database migration is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No backend API or persisted device-state format is changed.
- Existing automations continue to receive the same raw energy values as before.
- Existing HomeKit, Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, FRITZ!Box Presence, climate-mode, battery-warning, Pushover, virtual-device and automation functionality remains unchanged.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.39.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains patched `fast-uri` `3.1.5` and `4.1.2`.
- Retains PostCSS `8.5.23`.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.39
0.8
latest
```

## Git tag

```text
v0.8.39
```
