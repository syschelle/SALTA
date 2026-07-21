# SALTA v0.4.13

SALTA v0.4.13 improves Gen2+ Shelly onboarding and fixes compatibility with Shelly Plus 2PM devices that were incorrectly reported as unsupported.

## Highlights

- Reliable Shelly Plus 2PM detection
- Public `/shelly` identity probing for Gen2, Gen3 and Gen4
- RFC 7616 Digest authentication with SHA-256 support
- Compatible parameterless RPC status requests
- JSON-RPC frame fallback for firmware-specific endpoint behavior
- Expanded automated adapter and parser coverage

## Gen2+ Device Detection

SALTA now identifies Gen2, Gen3 and Gen4 devices through the public `/shelly` endpoint before requesting their full status. This avoids treating a status-call compatibility error as proof that the device is not a supported Shelly.

For parameterless methods such as `Shelly.GetStatus`, SALTA first uses the documented HTTP GET endpoint. If a firmware version rejects that endpoint with HTTP 400, 404 or 405, SALTA retries through `/rpc` with a complete JSON-RPC request frame.

## Authentication

Protected Gen2+ HTTP RPC calls now support RFC 7616 Digest authentication, including the SHA-256 algorithm used by current Shelly firmware.

Gen1 devices continue to use their existing Basic authentication flow.

## Shelly Plus 2PM

The release adds explicit regression coverage for the Shelly Plus 2PM switch profile, including:

- Device identification
- Two detected switch channels
- Current state and power parsing for the primary channel
- Digest-authenticated status requests
- JSON-RPC fallback behavior

The current SALTA device model registers the primary controllable channel and records the physical channel count. Independent dashboard cards and names for every channel remain separate multi-channel UI work.

## Diagnostics

Rejected onboarding attempts now record the original error object together with the request ID and device host in the structured SALTA log. This makes future reference IDs directly useful during troubleshooting.

## Updating

No manual database migration is required.

To pin this release:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.13
```

Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Quality Assurance

The following checks completed successfully:

- TypeScript strict type check
- 35 automated tests
- Production build
- Frontend JavaScript syntax validation
- Shell script syntax validation

## Container Tags

```text
0.4.13
0.4
latest
```

## Git Tag

```text
v0.4.13
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
