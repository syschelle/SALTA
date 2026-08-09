# SALTA v0.8.16

SALTA v0.8.16 fixes unsaved FRITZ!Box Presence credentials being cleared by the live page refresh while connection settings are being edited.

## Presence settings editing

- Fixed the FRITZ!Box password field being cleared a few seconds after entering a new password.
- Added a form-level unsaved-changes guard for the complete FRITZ!Box Presence configuration.
- While the form contains unsaved changes, SALTA no longer replaces the following fields during the five-second live refresh:
  - Presence detection enabled state
  - Protocol
  - FRITZ!Box host
  - Port
  - HTTPS certificate-verification option
  - Username
  - Password
  - Polling interval
  - Default absence delay
- The same protection applies when a background device refresh updates the Presence page.
- The connection status, household-presence summary and presence-device cards can still refresh normally while the settings form is being edited.

## Saving credentials

- The unsaved state is cleared only after the Presence settings have been stored successfully.
- After a successful save, SALTA reloads the persisted settings and intentionally clears the password input because passwords are never returned by the API.
- A stored password is still represented only by the existing `passwordConfigured` state and remains encrypted at rest.
- Leaving the password field empty continues to preserve an already stored FRITZ!Box password.

## TR-064 connection behavior

- Access to `/tr64desc.xml` confirms that the selected FRITZ!Box TR-064 HTTPS/HTTP endpoint is reachable.
- The actual Presence integration still uses the FRITZ!Box `Hosts:1` SOAP service for host-count and MAC-address queries.
- Depending on the FRITZ!Box configuration, those Hosts actions may require authentication even when `tr64desc.xml` itself can be opened without credentials.
- HTTP/HTTPS selection, ports `49000`/`49443`, Digest authentication and the request-scoped self-signed-certificate option remain unchanged.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- Existing FRITZ!Box settings and encrypted passwords remain compatible.
- Existing presence targets and automations remain unchanged.
- Existing Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device and HomeKit functionality remains unchanged.

## Security and dependencies

- FRITZ!Box passwords are still never returned to the browser after storage.
- HTTPS certificate verification remains enabled by default.
- The optional certificate-verification bypass remains scoped only to FRITZ!Box HTTPS requests.
- SALTA does not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- No production npm dependency was added or intentionally changed in v0.8.16.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7.

## Container tags

```text
0.8.16
0.8
latest
```

## Git tag

```text
v0.8.16
```
