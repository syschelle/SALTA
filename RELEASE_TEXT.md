# SALTA v0.8.17

SALTA v0.8.17 improves FRITZ!Box TR-064 authentication for Wi-Fi presence detection and makes authentication failures visible as clear, actionable connection errors.

## FRITZ!Box TR-064 authentication

- Added AVM SOAP content-level authentication for protected TR-064 actions.
- SALTA now performs the documented `InitChallenge` / `Challenge` / `ClientAuth` exchange when a FRITZ!Box username is configured.
- The response digest is calculated from the configured username, the FRITZ!Box `F!Box SOAP-Auth` realm, password and server nonce.
- The authenticated SOAP request is used for both `GetHostNumberOfEntries` and `GetSpecificHostEntry`.
- Standard HTTP Digest authentication remains available as a compatibility fallback for FRITZ!Box models or configurations that challenge at HTTP level.
- No MAC address is required for the **Connection test**; the test still validates the `Hosts:1` service using `GetHostNumberOfEntries`.

## Better authentication error handling

- SOAP authentication fault `503 / Auth. failed` is now recognized as an authentication result instead of a generic TR-064 failure.
- Added a dedicated **Authentication required** result when the Hosts service needs credentials but no usable username is configured.
- Added a dedicated **Authentication failed** result when the configured username or password is rejected.
- Added a dedicated **Authorization failed** result when login succeeds but the FRITZ!Box user does not have the required TR-064 permissions.
- The Presence page now explains these states directly in the FRITZ!Box connection card.

## Compatibility and reliability

- HTTP and HTTPS transport selection remains unchanged.
- Ports `49000` and `49443` remain independently selectable.
- The explicit self-signed-certificate option remains scoped only to FRITZ!Box HTTPS requests.
- Existing encrypted FRITZ!Box credentials remain compatible.
- Existing presence targets, absence delays and automations remain unchanged.
- Fixed a duplicated presence-device initialization statement that had accidentally remained in the previous source tree.
- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.

## Tests

- Added a transport test for AVM SOAP content-level authentication.
- The test verifies the official AVM example digest value for `admin`, realm `F!Box SOAP-Auth` and the documented nonce.
- Added coverage for rejected SOAP content-level credentials.
- Existing HTTP Digest compatibility coverage remains in place.

## Security and dependencies

- FRITZ!Box passwords remain encrypted at rest and are never returned to the browser.
- HTTPS certificate verification remains enabled by default.
- SALTA does not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- No production npm dependency was added or intentionally changed in v0.8.17.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7.

## Container tags

```text
0.8.17
0.8
latest
```

## Git tag

```text
v0.8.17
```
