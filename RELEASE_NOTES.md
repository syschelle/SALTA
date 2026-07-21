# SALTA v0.4.8

SALTA v0.4.8 fixes the Shelly onboarding error experience and strengthens re-adding devices after removal.

## Improvements

- Add-device errors are now displayed directly inside the open dialog instead of behind it.
- The error panel remains visible and includes an API request reference when available.
- Clear messages are provided for unreachable devices, authentication failures, timeouts, unsupported Shelly responses and invalid custom credentials.
- A custom credential mode now requires a username before the request is sent to the adapter.
- Optional integration listener failures can no longer turn a successfully persisted device into an apparent onboarding failure.
- A deleted Shelly can be added again with the same generated device ID.

## API behavior

Shelly onboarding errors now use stable structured error codes and appropriate HTTP status codes, including:

- `AUTHENTICATION_FAILED`
- `DEVICE_UNREACHABLE`
- `DETECTION_TIMEOUT`
- `UNSUPPORTED_DEVICE`
- `USERNAME_REQUIRED`
- `DEVICE_ADD_FAILED`

## Quality assurance

The release includes 18 automated tests covering device parsing, deletion, re-adding, registry race protection, API deletion and Shelly onboarding errors.

No manual database migration is required.
