# SALTA v0.8.19

SALTA v0.8.19 fixes the FRITZ!Box Presence connection flow by following the current FRITZ! TR-064 Hosts service requirements more closely and by making the actual Hosts control endpoint discoverable from `tr64desc.xml`.

## FRITZ!Box Hosts requests no longer authenticate unnecessarily

- `Hosts:GetHostNumberOfEntries` and `Hosts:GetSpecificHostEntry` are now attempted without authentication first.
- This matches the current FRITZ! TR-064 Hosts specification, where both actions require no user rights.
- A configured FRITZ!Box username no longer forces SALTA to send an `InitChallenge` / `ClientAuth` exchange for a Hosts action that the FRITZ!Box already permits anonymously on the local TR-064 interface.
- This prevents a configured or stale credential from breaking an otherwise valid Presence connection.
- HTTP Digest and SOAP content-level authentication remain available and are used only when the FRITZ!Box actually requests authentication.

## TR-064 service discovery

- SALTA now reads `/tr64desc.xml` on the configured HTTP/HTTPS endpoint and looks up the advertised `urn:dslforum-org:service:Hosts:1` service.
- The `controlURL` published by the FRITZ!Box is used for Hosts SOAP actions when available.
- The canonical `/upnp/control/hosts` path remains as a compatibility fallback if the service description cannot be read or does not expose a usable same-origin Hosts control URL.
- The discovered control URL is cached to avoid fetching the service description for every presence poll and every MAC-address query.

## Authentication fallback behavior

- SALTA first sends the normal Hosts SOAP action without credentials.
- If the FRITZ!Box returns an HTTP Digest challenge, SALTA retries with HTTP Digest using the configured credentials.
- If the FRITZ!Box requests SOAP content-level authentication, SALTA performs the documented `InitChallenge` / `Challenge` / `ClientAuth` flow.
- A `503 / Auth. failed` response can initiate the content-authentication flow when credentials are configured.
- Authentication failures continue to map to the existing dedicated SALTA Presence error codes.

## Better Presence diagnostics

- Failed manual connection tests now repeat the safe SALTA FRITZ!Box error code inside the structured system-log details as `errorCode`.
- Scheduled Presence synchronization errors and individual device-query errors also include the safe error code in their detail payload.
- FRITZ!Box passwords are still never written to the system log.

## Regression coverage

- Added coverage proving that configured credentials do not cause authentication to be sent for a successful rights-free Hosts request.
- Added coverage for deferred SOAP content-level authentication after the FRITZ!Box actually requests it.
- Added coverage for discovering and using a non-default Hosts `controlURL` from `tr64desc.xml`.
- Retained HTTP Digest compatibility coverage and request-scoped TLS certificate handling checks.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- Existing FRITZ!Box credentials and Presence targets remain compatible.
- Existing Presence automations remain unchanged.
- Existing Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device and HomeKit functionality remains unchanged.

## Security and dependencies

- FRITZ!Box passwords remain encrypted at rest and are never returned to the browser.
- HTTPS certificate verification remains enabled by default.
- The optional certificate-verification bypass remains scoped only to FRITZ!Box HTTPS requests.
- SALTA does not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- No production npm dependency was added or intentionally changed in v0.8.19.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7.

## Container tags

```text
0.8.19
0.8
latest
```

## Git tag

```text
v0.8.19
```
