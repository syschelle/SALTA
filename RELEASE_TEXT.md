# SALTA v0.4.8

SALTA v0.4.8 fixes Shelly device onboarding feedback and improves reliability when a removed device is added again.

## Highlights

- Add-device errors are now shown inside the open Shelly dialog
- Clear messages for unreachable devices, authentication failures and timeouts
- Reliable re-adding of previously removed Shelly devices
- Structured API error codes and request references
- Improved isolation between core device persistence and optional integrations
- Expanded automated test coverage

## Add-Device Dialog

Previously, onboarding failures were displayed through the global toast notification. Native modal dialogs are rendered in the browser's top layer, so the red toast could appear behind the open dialog and remain unreadable.

SALTA now displays onboarding errors directly inside the dialog. The message remains visible until the user changes the onboarding mode, retries the request or closes the dialog.

The dialog provides clear feedback for:

- Unreachable devices
- Authentication failures
- Detection timeouts
- Unsupported Shelly responses
- Invalid form data
- Missing usernames for custom credentials
- Unexpected persistence failures

When the API provides a request ID, it is included as a reference for log correlation.

## Device Re-Adding

A Shelly device removed from SALTA can be added again through the normal onboarding workflow. The release adds adapter-level coverage proving that the same physical device and generated SALTA device ID can be restored after deletion.

Optional integration listeners, such as HomeKit synchronization, are isolated from core persistence. A listener failure no longer causes an otherwise successful device registration to be reported as failed.

## API

The Shelly onboarding endpoint continues to use:

```http
POST /api/adapters/shelly/devices
```

Errors now return stable codes and appropriate HTTP statuses, including:

```text
AUTHENTICATION_FAILED
DEVICE_UNREACHABLE
DETECTION_TIMEOUT
UNSUPPORTED_DEVICE
USERNAME_REQUIRED
DEVICE_ADD_FAILED
```

## Quality Assurance

The following checks completed successfully:

- TypeScript strict type check
- 18 automated tests
- Production build
- Frontend JavaScript syntax validation
- Shell script syntax validation
- Compose YAML parsing

## Updating

No manual database migration is required.

To pin this release explicitly:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.8
```

Then update with:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.8
0.4
latest
```

## Git Tag

```text
v0.4.8
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
