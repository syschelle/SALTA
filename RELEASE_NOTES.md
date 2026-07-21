# SALTA v0.4.13

SALTA v0.4.13 improves Gen2+ Shelly onboarding, with a particular focus on Shelly Plus 2PM compatibility.

## Fixed

- Shelly Plus 2PM devices are no longer rejected when their firmware does not accept an empty POST to `Shelly.GetStatus`.
- Gen2, Gen3 and Gen4 devices are identified through the public `/shelly` endpoint before their protected status is requested.
- Protected Gen2+ RPC calls now use RFC 7616 Digest authentication with SHA-256 instead of Basic authentication.
- SALTA falls back to a complete JSON-RPC request frame when a method-specific GET endpoint is unavailable.
- A device already identified as Gen2+ is no longer incorrectly reported as having no supported Shelly interface when only its status request fails.
- Rejected onboarding attempts now include the underlying error in the structured container log.

## Shelly Plus 2PM

The parser recognizes the Plus 2PM switch profile and both available switch channels. The current device model continues to register the primary controllable channel while retaining the detected channel count for subsequent multi-channel UI work.

## Compatibility

No database migration is required. Gen1 Basic authentication remains supported.

## Quality assurance

The release passes TypeScript strict checking, 35 automated tests, frontend JavaScript syntax validation and the production build.
