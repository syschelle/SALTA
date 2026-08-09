# SALTA v0.8.15

SALTA v0.8.15 improves the FRITZ!Box Presence page with a clear TR-064 connection status and a cleaner connection-settings layout.

## Clear FRITZ!Box connection status

- The Presence page now shows whether the FRITZ!Box TR-064 endpoint is technically reachable independently of whether automatic presence detection is enabled.
- Added dedicated connection states for:
  - Connection not tested yet
  - Connection in progress / waiting for the first automatic query
  - FRITZ!Box reachable
  - Connection failed
- A successful manual test shows the number of FRITZ!Box home-network devices returned by TR-064.
- The last manual test time and tested endpoint are shown in the connection status.
- Failed manual tests remain visible in the connection card with the corresponding SALTA-friendly error message.
- The adapter keeps the latest manual connection-test result in memory so returning to the Presence page does not immediately lose the result.

## Improved connection test workflow

- Moved **Connection test** directly next to the FRITZ!Box connection status.
- The result is now visible in the page itself instead of relying only on a temporary toast notification.
- The connection test continues to work while **Presence detection** is disabled.
- Testing unsaved connection settings no longer overwrites the protocol, host, port, TLS, username or password fields while the result is refreshed.

## Cleaner TR-064 endpoint layout

- Reorganized the FRITZ!Box connection form for better visual balance.
- **FRITZ!Box / Host** now uses the full available width.
- **Protocol** and **Port** are displayed below the host as two equally sized controls.
- HTTP and HTTPS remain independently selectable.
- Ports `49000` and `49443` remain independently selectable.
- The existing HTTPS-only **Disable certificate verification** option remains unchanged.
- Added responsive behavior so the connection status, test button, protocol and port stack cleanly on narrow screens.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- Existing FRITZ!Box connection settings and presence targets remain compatible.
- Existing presence automations remain unchanged.
- Existing Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device and HomeKit functionality remains unchanged.

## Security and dependencies

- HTTPS certificate verification remains enabled by default.
- The existing certificate-verification bypass remains explicitly opt-in and scoped only to FRITZ!Box HTTPS requests.
- SALTA still does not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- No production npm dependency was added or intentionally changed in v0.8.15.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7.

## Container tags

```text
0.8.15
0.8
latest
```

## Git tag

```text
v0.8.15
```
