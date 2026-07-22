# Dependency notes

SALTA v0.5.3 removes deprecated code and dependency paths controlled directly by the project.

- The direct `@fastify/static` dependency was removed and replaced with a small allow-listed static-file handler.
- The obsolete `glob` dependency chain that accompanied it is no longer part of the lockfile.
- No SALTA direct dependency is marked as deprecated in `package-lock.json`.

## Upstream HomeKit exception

The current HomeKit integration still brings in `node-persist@0.0.12` through `@homebridge/hap-nodejs`. That package in turn declares the deprecated `q` package. SALTA does not call `q` directly.

This upstream dependency is intentionally retained to preserve HomeKit support. Removing it inside SALTA would require replacing or forking the HomeKit persistence implementation and should not be presented as a safe cleanup without full HomeKit interoperability testing.
