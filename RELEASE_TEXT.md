# SALTA v0.8.137

SALTA v0.8.137 adds FRITZ!OS version detection to FRITZ!Box Smart Home diagnostics while keeping PBKDF2 challenge validation authoritative.

## Changes

- Query the official FRITZ!Box TR-064 `DeviceInfo:GetInfo` action before Smart Home SID authentication.
- Read and expose `NewSoftwareVersion` as the detected FRITZ!OS version.
- Show the detected FRITZ!OS version in the Smart Home connection status on the Presence page.
- Record successful and failed FRITZ!OS detection in the persistent system log without credentials, passwords or SID values.
- Keep the v0.8.136 PBKDF2-only Smart Home login policy unchanged.

## Root Cause

The v0.8.136 security fix correctly removed the legacy MD5 SID challenge fallback, but a rejected non-PBKDF2 challenge did not identify the FRITZ!OS version of the connected router. This made it harder to distinguish an outdated FRITZ!OS installation from another authentication problem.

v0.8.137 uses AVM's documented TR-064 DeviceInfo service to obtain the FRITZ!OS software version before Smart Home authentication. The version is diagnostic context only. SALTA still decides whether authentication is acceptable exclusively from the actual SID challenge and never restores the legacy MD5 password path.

## Compatibility

- No database schema change or manual migration is required.
- Existing FRITZ!Box presence and Smart Home credentials remain unchanged.
- Existing imported FRITZ!Box device IDs, room assignments and presentation settings remain unchanged.
- FRITZ!Box Smart Home authentication remains PBKDF2-only.
- A failure to read DeviceInfo does not block an otherwise valid Smart Home login.
- Existing Shelly, deCONZ, Hue, OpenCCU, virtual-device, automation and HomeKit data remain unchanged.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.

## Tests

- Regression coverage verifies the TR-064 DeviceInfo SOAP action and `NewSoftwareVersion` parsing.
- Regression coverage verifies that Smart Home connection status exposes the detected FRITZ!OS version.
- Regression coverage verifies that the version is written to diagnostics before Smart Home login.
- Release validator enforces the DeviceInfo and Smart Home diagnostic contracts.
- Full GitHub Actions quality gate must pass before release.
- GitHub CodeQL on `main` remains the authoritative security scan after integration.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.
