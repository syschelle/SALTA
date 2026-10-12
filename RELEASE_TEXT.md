# SALTA v0.8.117

SALTA v0.8.117 adds a complete sanitized runtime diagnostic export for troubleshooting complex installations without sharing credentials.

## Changes

- The System Log page now provides **Export diagnostics**.
- The generated JSON combines the current SALTA version and safe runtime parameters, adapter status, rooms, automations, current device registry state and the retained system log.
- OpenCCU/HomeMatic diagnostic metadata such as interface name, channel address, channel type, data-point mappings, current state and capabilities remains available for analysis.
- Presence targets are included by logical identity and timing configuration, while MAC and IP addresses are deliberately omitted.
- HomeKit status is exported without pairing PIN, setup URI or bridge username.
- Adapter settings expose only non-secret configuration and configured/encryption status flags.
- Passwords, API/application/user keys, tokens, sessions, credential usernames and encrypted secret fields are removed recursively from the payload.
- A final known-secret guard compares the generated JSON against readable configured secrets and aborts the export if any plaintext secret is present.
- The export is delivered as a downloadable JSON file and is marked `no-store`.
- Creating an export writes a credential-free `DIAGNOSTIC_EXPORT_CREATED` system-log event.
- GitHub CI now validates `work/**` branches directly, so development validation does not require temporary pull requests.

## Root Cause

Previous SALTA diagnostics were intentionally split across workflow exports, individual automation execution exports, adapter status and the System Log. That was sufficient for targeted issues, but not for reconstructing the complete runtime logic of a complex installation in one support artifact. The configuration backup is not suitable for this purpose because it is designed for restore and can contain encrypted credential material.

v0.8.117 introduces a separate support-oriented export with explicit secret sanitization and a fail-closed plaintext-secret guard. It does not reuse the restore backup format.

## Compatibility

- No database schema change or migration is required.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing automations and adapter configuration require no editing.
- Existing PostgreSQL and SALTA runtime volumes remain compatible.
- Existing HomeKit pairing state remains compatible.
- OpenCCU/HomeMatic thermostat command semantics are unchanged.

## Tests

- Diagnostic sanitizer regression coverage verifies removal of credential fields while preserving diagnostic fields such as `stateKey`, `valueKey` and HomeMatic data-point metadata.
- Secret-guard coverage verifies that an export fails closed when a known plaintext secret is found anywhere in the payload.
- Frontend coverage verifies the one-click download and backend route wiring.
- The release validator verifies static asset serving, export composition and secret-sanitizer presence.
- TypeScript build, JavaScript syntax checks and the complete test suite must pass in GitHub Actions before tagging the release.

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
