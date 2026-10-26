# SALTA v0.8.136

SALTA v0.8.136 removes the legacy MD5 password challenge fallback from FRITZ!Box Smart Home authentication and requires AVM's PBKDF2 SID login for the Smart Home REST integration.

## Changes

- Remove the legacy MD5 challenge-response path from `src/fritzbox-smarthome.ts`.
- Require a modern AVM PBKDF2 SID challenge beginning with `2$`.
- Reject legacy Smart Home SID challenges with the explicit diagnostic `FRITZBOX_SMARTHOME_PBKDF2_REQUIRED`.
- Keep the separate FRITZ!Box Presence/TR-064 authentication behavior unchanged, including protocol-mandated HTTP Digest compatibility.
- Add regression coverage and a release-validator contract that prevents direct MD5 password hashing from being reintroduced into the Smart Home adapter.

## Root Cause

SALTA correctly requested `login_sid.lua?version=2` and implemented AVM's modern two-stage PBKDF2 challenge-response flow. However, when the returned challenge did not begin with `2$`, the Smart Home adapter still fell back to the historical FRITZ!Box MD5 password challenge. GitHub CodeQL correctly identified that fallback as `js/insufficient-password-hash` / CWE-916 because it feeds the configured FRITZ!Box password into a fast MD5 calculation.

The Smart Home REST integration now fails closed instead of calculating the MD5 response. This change is intentionally limited to Smart Home SID authentication; the separate TR-064 Presence adapter retains only the MD5 operations required by the TR-064/HTTP Digest protocol and keeps those operations isolated and documented.

## Compatibility

- FRITZ!Box Smart Home login now requires PBKDF2-capable SID authentication.
- Current FRITZ!OS versions that return a `2$...` challenge continue to work without configuration changes.
- A legacy FRITZ!Box that returns only the old SID challenge will no longer be accepted by the Smart Home REST adapter and will report `FRITZBOX_SMARTHOME_PBKDF2_REQUIRED`.
- FRITZ!Box Presence/TR-064 behavior is unchanged.
- No database schema change or manual migration is required.
- Existing FRITZ!Box credentials, Smart Home settings, device IDs and SALTA room assignments remain unchanged.
- No new npm dependency or mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.

## Tests

- Regression coverage verifies the documented AVM PBKDF2 SID response calculation.
- Regression coverage verifies that legacy SID challenges are rejected instead of entering an MD5 password-hash path.
- Release validator requires `FRITZBOX_SMARTHOME_PBKDF2_REQUIRED` and rejects direct `createHash("md5")` or legacy-password fallback code in the Smart Home adapter.
- Release validator passed for SALTA v0.8.136.
- JavaScript syntax checks passed.
- TypeScript production build passed.
- Test symbol preflight passed for 106 test files.
- 106 of 106 test files passed.
- 586 of 586 tests passed.
- Full CI on `main` passed successfully.

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
