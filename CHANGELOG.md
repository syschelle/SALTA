# Changelog

## 0.2.5 - 2026-07-20

### Fixed

- Replaced internal package registry URLs in `package-lock.json` with the public npm registry.
- Prevented `npm ci` from hanging in GitHub Actions and Docker Buildx.
- Added a fail-fast check for accidental internal registry URLs.
- Added an explicit public npm registry configuration.


## 0.2.3 - 2026-07-20

- Prevent running CI jobs from being canceled when another commit or workflow run is queued.
- Prevent running multi-architecture release builds from being canceled by newer runs.
- Keep the 60-minute release timeout for reliable AMD64 and ARM64 image publishing.
- Add ready-to-use GitHub release notes for this maintenance release.

## 0.2.2

- Simplified and hardened the GHCR release workflow.
- Added explicit package write permissions and repository source labels.
- Normalized the GHCR image name to lowercase.
- Added workflow concurrency cancellation and timeouts.
- Removed the duplicate Docker build from CI.
- Publishes one multi-architecture image for linux/amd64 and linux/arm64.

## 0.2.1 - 2026-07-20

- Publish a single multi-architecture GHCR image for `linux/amd64` and `linux/arm64`.
- Add QEMU and Buildx setup to the GitHub release workflow.
- Change the default Compose deployment from local build to prebuilt image pull.
- Add optional ARM64 and AMD64 Compose overrides.
- Add a separate local-development build override.
- Avoid the second network-based `npm ci` step in the Dockerfile.
- Update deployment and update scripts for image-only production deployment.

## 0.2.0 - 2026-07-20

- Rebuild SALTA as a typed Fastify and PostgreSQL project foundation.
- Add responsive dashboard, device registry, command history and mock adapter.
- Add health checks, HomeKit foundation, CI and Docker deployment.

## 0.1.1 - 2026-07-20

- Fix invalid HAP-NodeJS dependency version.
- Add a reproducible npm lockfile.
- Use `npm ci` in Docker and CI builds.
- Update HomeKit bridge code for HAP-NodeJS 2.x compatibility.

## 0.1.0 - 2026-07-20

Initial public prototype release.

## [0.2.4] - 2026-07-20

### Fixed

- Run npm dependency installation on the native build platform instead of ARM64 QEMU.
- Avoid duplicated dependency installation during multi-platform image generation.
- Increase the release workflow timeout and reduce cache-export overhead.

