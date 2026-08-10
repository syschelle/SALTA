# SALTA v0.8.18

SALTA v0.8.18 adds persistent system-log coverage for FRITZ!Box presence failures and recoveries, making presence diagnostics available outside the transient Presence-page status.

## Presence errors in the system log

- Failed manual **Connection test** requests are now written to the persistent SALTA system log with source `presence`.
- Automatic FRITZ!Box/TR-064 synchronization failures are logged as errors.
- Individual MAC-address query failures are logged as warnings with the affected presence target.
- Authentication, authorization, TLS certificate, timeout, unreachable-host and unexpected TR-064 response codes are retained in the log entry.
- The Presence page already has its own `presence` source filter in the System Log, so these events can be isolated directly.
- A failed Presence connection status now provides a direct **Open system log** link.

## Recovery logging and log-noise protection

- SALTA records an informational recovery event when the FRITZ!Box presence connection becomes healthy again after a synchronization failure.
- SALTA records an informational recovery event when an individual presence target becomes queryable again.
- Repeated identical scheduled connection errors are deduplicated until the error changes or the connection recovers.
- Repeated identical per-device query errors are deduplicated per presence target until the device query recovers or the error changes.
- Explicit manual connection tests remain individually logged because each test is a user-initiated diagnostic action.

## Safe diagnostic details

- Presence log entries may include the TR-064 endpoint, target name, target ID, MAC address, host count and whether the explicit TLS-certificate bypass is active.
- FRITZ!Box passwords are never written to the system log.
- The configured password is never included in diagnostic detail objects.
- The connection-test log stores only whether a username was configured, not the password.

## Presence adapter reliability

- Cleans the stored per-target error state after a successful device query so the card reflects recovery correctly.
- Removes stale per-target error-deduplication state when a monitored presence target is deleted.
- Removed an accidental duplicate `reload()` declaration from the Presence adapter source.
- Existing presence hysteresis and last-known-state behavior remain unchanged: a FRITZ!Box outage does not automatically mark everyone as absent.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- Existing FRITZ!Box credentials, transport settings, presence targets and automations remain compatible.
- Existing Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device and HomeKit functionality remains unchanged.

## Security and dependencies

- FRITZ!Box passwords remain encrypted at rest and are never returned to the browser.
- HTTPS certificate verification remains enabled by default.
- The optional certificate-verification bypass remains scoped only to FRITZ!Box HTTPS requests.
- SALTA does not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- No production npm dependency was added or intentionally changed in v0.8.18.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7.

## Container tags

```text
0.8.18
0.8
latest
```

## Git tag

```text
v0.8.18
```
