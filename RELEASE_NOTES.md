# SALTA v0.2.4

## Fixed

- Prevented dependency installation from running under ARM64 QEMU during multi-architecture builds.
- Reduced the amount of duplicated work in AMD64 and ARM64 container builds.
- Kept release workflows from canceling an active build.
- Increased the release-job timeout for first-time, uncached builds.

## Changed

- Docker dependency installation and TypeScript compilation now run on the native GitHub runner architecture.
- The final runtime image is still produced separately for `linux/amd64` and `linux/arm64`.
- GitHub Actions cache export uses `mode=min` to reduce post-build upload time.

## Docker

- linux/amd64
- linux/arm64

Create a new `v0.2.4` tag after pushing these changes. Re-running an older tag uses the workflow stored in that older tagged commit and will not apply this fix.
