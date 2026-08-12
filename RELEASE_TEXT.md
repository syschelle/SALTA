# SALTA v0.8.28

SALTA v0.8.28 improves Shelly reachability handling, especially for multi-channel Gen4 devices such as the Shelly 2PM Gen4, by reducing duplicate polling and adding tolerance for short network or RPC interruptions.

## Shared polling for multi-channel Shelly devices

- SALTA now groups Shelly Gen2+, Gen3 and Gen4 logical devices by their physical host during the regular background reconciliation.
- A multi-channel Shelly such as the Shelly 2PM Gen4 is polled only once per reconciliation cycle using `Shelly.GetStatus`.
- The returned component states are then distributed to the matching logical SALTA devices, for example `switch:0` and `switch:1`.
- This removes the previous behavior where every logical channel independently performed a complete device probe against the same physical Shelly.
- Normal onboarding and explicit device probing still obtain device identity and configuration as before.

## More robust reachability

- Added a single short retry for transient status failures such as connection resets, timeouts and temporary HTTP 5xx responses.
- A single failed background poll no longer immediately marks a Shelly offline.
- SALTA now requires three consecutive failed reconciliation cycles before marking the physical Shelly and its logical channels offline.
- With the existing 10-second Shelly polling interval, short interruptions of one or two cycles therefore no longer create a false offline indication.
- Any successful status poll immediately resets the failure counter and restores all logical devices for that Shelly to online.

## Last-seen behavior

- `lastSeen` continues to update only after a successful Shelly response.
- Failed or retried polls do not overwrite the last successful contact timestamp.
- When a Shelly finally reaches the offline threshold, the configuration dialog still shows when the device was actually last reachable.

## Regression coverage

- Added coverage proving that a two-channel Shelly 2PM Gen4 produces only one `Shelly.GetStatus` poll per reconciliation cycle.
- Added coverage for the three-cycle offline hysteresis and immediate recovery after a successful poll.
- Existing Shelly command, authentication, cover and multi-profile behavior remains unchanged.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- Existing Shelly devices, credentials, room assignments, presentation overrides, automations and HomeKit exports remain compatible.
- Existing FRITZ!Box Presence, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight and virtual-device functionality remains unchanged.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.28.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains the patched `fast-uri` dependency versions introduced in v0.8.21.
- Retains PostCSS `8.5.23` in the development dependency tree.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.28
0.8
latest
```

## Git tag

```text
v0.8.28
```
