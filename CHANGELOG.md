# Changelog

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
