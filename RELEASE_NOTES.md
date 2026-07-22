# SALTA v0.5.3

SALTA v0.5.3 fixes the Shelly onboarding dialog closing immediately after a device authentication error.

## Device onboarding fix

- Distinguished SALTA session authentication failures from Shelly device authentication failures
- Redirects to the SALTA login page only when the API returns the explicit `UNAUTHORIZED` session error
- Keeps the “Add Shelly” dialog open when a Shelly rejects the supplied credentials
- Preserves the readable in-dialog authentication error so credentials can be corrected immediately
- Returns Shelly credential failures as HTTP 422 instead of HTTP 401 to avoid treating an upstream device error as a SALTA logout
- Added regression coverage for both the frontend redirect decision and the Shelly onboarding API response

## Runtime behavior

- No database schema changes
- No environment or Docker Compose changes
- No clean reinstall is required when updating from v0.5.0, v0.5.1 or v0.5.2
- The v0.5 clean-install requirement still applies only when coming from v0.4.x

## Updating

```bash
./update.sh
```

For a new installation:

```bash
./install.sh --fresh
```

## Container tags

```text
0.5.3
0.5
latest
```

## Git tag

```text
v0.5.3
```
