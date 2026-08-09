# SALTA v0.8.14

SALTA v0.8.14 improves the FRITZ!Box presence integration with explicit TR-064 transport controls and safe, request-scoped support for self-signed HTTPS certificates.

## FRITZ!Box connection settings

- Split the previous combined TR-064 address field into dedicated **Protocol**, **FRITZ!Box / Host** and **Port** controls on the Presence page.
- Added explicit selection of both supported transport protocols:
  - `HTTP`
  - `HTTPS`
- Added both common FRITZ!Box TR-064 ports:
  - `49000`
  - `49443`
- Protocol and port remain independently selectable, so SALTA does not force a specific combination.
- Existing v0.8.13 `baseUrl` settings are parsed automatically and shown in the new controls.

## Self-signed HTTPS certificates

- Added an explicit **Disable certificate verification** checkbox to the Presence page.
- The option is available only for HTTPS connections.
- When enabled, SALTA accepts a self-signed or otherwise locally untrusted certificate for the configured FRITZ!Box connection.
- The bypass is scoped only to FRITZ!Box HTTPS requests.
- SALTA does **not** set `NODE_TLS_REJECT_UNAUTHORIZED=0` and does not weaken TLS verification for Phoscon, OpenCCU, Shelly, HomeKit, the web server or any other integration.
- Added a dedicated `FRITZBOX_TLS_CERTIFICATE` error so a failed certificate check is shown clearly in the Presence UI.

## TR-064 transport

- Reworked FRITZ!Box SOAP communication to use request-scoped Node.js HTTP/HTTPS requests.
- HTTPS requests use normal certificate validation by default.
- `rejectUnauthorized` is disabled only for the individual FRITZ!Box request when the user explicitly enables the certificate-verification bypass.
- Retains HTTP Digest authentication for protected FRITZ!Box Hosts requests.
- Retains request timeouts, host-count connection testing and targeted `GetSpecificHostEntry` requests by MAC address.
- Existing presence hysteresis, last-known-state preservation and house-presence aggregation remain unchanged.

## Persistence and compatibility

- Added the canonical additive `fritzbox_presence_transport_settings` table for the TLS verification preference.
- No incremental `ALTER TABLE` migration is used.
- The new table is created automatically during normal SALTA schema initialization.
- No manual database command is required.
- Existing FRITZ!Box credentials, presence targets and v0.8.13 connection addresses remain compatible.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.

## Security and dependencies

- Certificate verification remains enabled by default.
- Disabling verification requires an explicit user setting and applies only to the configured FRITZ!Box HTTPS transport.
- No production npm dependency was added or intentionally changed in v0.8.14.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7.

## Container tags

```text
0.8.14
0.8
latest
```

## Git tag

```text
v0.8.14
```
