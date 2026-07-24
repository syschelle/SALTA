# SALTA v0.7.2

SALTA v0.7.2 improves OpenCCU session management and prevents repeated JSON-RPC logins from exhausting the CCU session limit.

## OpenCCU session management

- Reuses one persistent OpenCCU JSON-RPC session for scheduled synchronization and HomeMatic device commands
- Serializes OpenCCU diagnostics, configuration, synchronization and commands so SALTA does not create overlapping sessions
- Closes the runtime session when OpenCCU is reconfigured or disconnected and during a controlled SALTA shutdown
- Adds single-flight login handling so concurrent calls cannot start duplicate login requests
- Automatically creates a fresh session once when OpenCCU reports that the current session is invalid
- Pauses scheduled login retries for five minutes after OpenCCU error 501 to avoid increasing session pressure

## Diagnostics and errors

- Distinguishes OpenCCU error 501 as an ambiguous credentials-or-session-limit condition instead of reporting it as a definite password failure
- Keeps the original OpenCCU remote code and message visible in Settings and the System Log
- Includes `Session.logout` in the diagnostic report
- Treats a failed diagnostic logout as a warning without hiding the preceding diagnostic result
- Logs a warning when the persistent runtime session cannot be closed cleanly

## Compatibility

- No database schema migration is required
- No new `.env` variable is required
- No fresh installation is required
- Existing Shelly, Zigbee, HomeMatic, room and adapter data remain unchanged

## Updating

```bash
./update.sh
```

For a new installation:

```bash
./install.sh
```

## Container tags

```text
0.7.2
0.7
latest
```

## Git tag

```text
v0.7.2
```
