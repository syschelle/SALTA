# SALTA v0.4.9

SALTA v0.4.9 adds proactive encryption-key validation and improves live power measurement selection for Shelly devices.

## Improvements

- Stored global and per-device Shelly credentials are checked during startup and through `/api/readiness`.
- A mismatching `SALTA_ENCRYPTION_KEY` now produces the specific `ENCRYPTION_KEY_MISMATCH` error.
- The web interface warns before onboarding and disables inherited credentials until the global password is saved again.
- New secrets use AES-256-GCM with a per-secret random salt and a `scrypt`-derived 256-bit key.
- Valid legacy v1 secrets remain readable and are upgraded automatically.
- New installations receive a randomly generated encryption key from `deploy.sh`.
- Dedicated `PM1` and `EM1` components are preferred for live power, voltage, current and energy values.
- A single separate metering component is used even when its component ID differs from the switch ID.

## Compatibility

No manual database migration is required. Existing `.env` files remain valid and must retain their current `SALTA_ENCRYPTION_KEY`.

## Quality assurance

The release passes TypeScript strict checking, 24 automated tests, frontend JavaScript syntax validation and the production build.
