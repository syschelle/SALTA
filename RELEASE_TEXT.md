# SALTA v0.8.20

SALTA v0.8.20 fixes FRITZ!Box TR-064 SOAP requests being rejected with HTTP 411 `Length Required` on FRITZ!OS versions that require an explicit request body length.

## FRITZ!Box HTTP 411 fix

- Added an explicit `Content-Length` header to every FRITZ!Box TR-064 SOAP POST request.
- The header is calculated with the actual UTF-8 byte length of the XML body using `Buffer.byteLength(...)`.
- This prevents Node.js from falling back to `Transfer-Encoding: chunked` for the SOAP body.
- FRITZ!Box models or FRITZ!OS versions that reject chunked TR-064 SOAP requests with HTTP 411 can now process the request normally.
- The fix applies to all Presence SOAP requests, including:
  - `GetHostNumberOfEntries`
  - `GetSpecificHostEntry`
  - HTTP Digest retries
  - SOAP `InitChallenge` requests
  - SOAP `ClientAuth` requests

## TR-064 request compatibility

- Added the `SALTA TR-064 Client` user agent to SOAP POST requests.
- Added an explicit `Connection: close` header to keep the request framing deterministic and compatible with the FRITZ! TR-064 examples.
- Existing discovery of the Hosts `controlURL` from `/tr64desc.xml` remains unchanged.
- Existing HTTP Digest and SOAP content-level authentication fallbacks remain unchanged.
- Existing HTTPS/self-signed-certificate handling remains request-scoped to the FRITZ!Box adapter.

## Diagnostics

- Added a dedicated German UI message for `FRITZBOX_HTTP_411` instead of showing only the generic Presence failure text.
- The API now also returns a dedicated diagnostic message when a FRITZ!Box responds with HTTP 411.
- Presence failures continue to be persisted under the `presence` source in the SALTA System Log without exposing credentials.

## Regression coverage

- Added a transport regression test that verifies every SOAP request carries a non-zero `Content-Length` header.
- The test verifies that the header matches the exact UTF-8 byte length of the transmitted XML body.
- The test also verifies that the SOAP request is not sent with `Transfer-Encoding: chunked`.
- Release validation now requires the explicit FRITZ!Box SOAP `Content-Length` implementation so this compatibility fix cannot be removed accidentally.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- Existing FRITZ!Box credentials, transport settings, Presence targets and automations remain compatible.
- Existing Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device and HomeKit functionality remains unchanged.

## Security and dependencies

- FRITZ!Box passwords remain encrypted at rest and are never returned to the browser.
- HTTPS certificate verification remains enabled by default.
- The optional certificate-verification bypass remains scoped only to FRITZ!Box HTTPS requests.
- SALTA does not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- No production npm dependency was added or intentionally changed in v0.8.20.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7.

## Container tags

```text
0.8.20
0.8
latest
```

## Git tag

```text
v0.8.20
```
