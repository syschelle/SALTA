# Dependency notes

SALTA removes deprecated code and dependency paths controlled directly by the project.

- The direct `@fastify/static` dependency was removed and replaced with a small allow-listed static-file handler.
- The obsolete `glob` dependency chain that accompanied it is no longer part of the lockfile.
- The redundant direct `pino` dependency was removed; Fastify continues to provide the runtime logger through its own dependency graph.
- No SALTA direct dependency is marked as deprecated in `package-lock.json`.
- `find-my-way` is pinned through an npm override to `9.7.0` to remediate CVE-2026-47219 / GHSA-c96f-x56v-gq3h. This keeps Docker builds using `npm ci` on the patched Fastify router release.
- `@homebridge/dbus-native` is pinned to `0.7.7`. SALTA v0.7.8 accidentally changed its lockfile package version and URL to 0.7.8 while retaining the 0.7.7 integrity checksum, causing `npm ci` to stop with `EINTEGRITY`. The v0.7.9 lockfile restores one internally consistent package record.

## Upstream HomeKit exception

The current HomeKit integration still brings in `node-persist@0.0.12` through `@homebridge/hap-nodejs`. That package in turn declares the deprecated `q` package. SALTA does not call `q` directly.

This upstream dependency is intentionally retained to preserve HomeKit support. Removing it inside SALTA would require replacing or forking the HomeKit persistence implementation and should not be presented as a safe cleanup without full HomeKit interoperability testing.

## Release lockfile validation

`npm run validate:release` verifies the exact security overrides and the Homebridge DBus tarball metadata before tests or container publication. Future SALTA version bumps must use `npm run version:set -- <version>` so only the root application version is changed in `package-lock.json`.
