# SALTA v0.4.9

SALTA v0.4.9 adds proactive encryption-key validation and improves Shelly live power measurements.

## Highlights

- Detect mismatching encryption keys before Shelly onboarding
- Clear recovery guidance in Settings and the add-device dialog
- Stronger key derivation for newly stored credentials
- Backward-compatible migration of existing encrypted secrets
- Improved `PM1` and `EM1` measurement selection
- Random encryption keys for new installations

## Credential Protection

SALTA must be able to retrieve Shelly passwords for local device requests, so the credentials are stored with authenticated reversible encryption rather than a one-way password hash.

Newly saved credentials use:

- AES-256-GCM authenticated encryption
- A unique random salt for every stored secret
- A `scrypt`-derived 256-bit encryption key
- A unique random initialization vector

Existing v1 AES-256-GCM values remain supported. When the configured key can decrypt them, SALTA upgrades them automatically to the new v2 format.

## Encryption-Key Validation

SALTA now checks global and per-device encrypted Shelly credentials during startup and through:

```http
GET /api/readiness
```

When the configured `SALTA_ENCRYPTION_KEY` does not match stored credentials:

- Startup logs contain a clear encryption-key warning
- Readiness reports the credentials component as invalid
- Inherited credentials are disabled in the add-device dialog
- Settings display instructions to enter and save the password again
- API requests return `ENCRYPTION_KEY_MISMATCH` instead of a generic server error

No encrypted value is deleted automatically.

## New Installations

`deploy.sh` now generates a random 256-bit `SALTA_ENCRYPTION_KEY` together with the database and administrator credentials.

The generated `.env` file must be retained and included in secure backups.

## Power Measurements

SALTA now treats a dedicated `PM1` or `EM1` component as the authoritative source for power, voltage, current and energy values when one is available.

This fixes devices that expose a stale `0 W` value on the switch component while the dedicated metering component contains the current measurement. SALTA also uses a single separate meter when its component ID differs from the controlled switch.

## Quality Assurance

The following checks completed successfully:

- TypeScript strict type check
- 24 automated tests
- Production build
- Frontend JavaScript syntax validation
- Shell script syntax validation

## Updating

No manual database migration is required.

Keep the existing `SALTA_ENCRYPTION_KEY` unchanged when updating. To pin this release:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.9
```

Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.9
0.4
latest
```

## Git Tag

```text
v0.4.9
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
