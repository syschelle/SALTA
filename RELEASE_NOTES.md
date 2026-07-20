# SALTA v0.2.5

## Fixed

- Replaced inaccessible internal npm registry URLs in `package-lock.json` with `https://registry.npmjs.org/`.
- Fixed GitHub Actions and Docker Buildx hanging during `npm ci` before being canceled.
- Added a fail-fast lockfile validation step to CI.
- Added an explicit public npm registry configuration for reproducible builds.

## Docker

- linux/amd64
- linux/arm64

This release fixes the actual root cause of the canceled image builds. The previous lockfile referenced an internal registry that GitHub-hosted runners could not access.
