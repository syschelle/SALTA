# SALTA v0.7.12

SALTA v0.7.12 hardens the build and release process after a valid frontend change was rejected by an obsolete exact-string regression assertion.

## Fixed

- Fixed the failing OpenCCU frontend test that still expected the exact call `targetTemperatureControl(d)`.
- The current renderer correctly calls `targetTemperatureControl(d, instance)` so overview and adapter-page controls receive unique HTML IDs.
- Replaced the critical exact-call assertion with a TypeScript-AST source contract.
- The test now verifies that:
  - `targetTemperatureControl` exists;
  - `deviceCard` invokes it with at least the required device argument; and
  - the generated control still sends the target-temperature command.
- Applied the same structural test approach to critical thermostat-mode and overview renderer relationships.

## Build reliability

- Added `npm run validate:release` to verify:
  - `package.json` and both package-lock root versions match;
  - all current-version surfaces are synchronized;
  - package-lock tarballs use the public npm registry over HTTPS;
  - `find-my-way` remains pinned to 9.7.0;
  - `@homebridge/dbus-native` remains pinned to 0.7.7 with its matching tarball URL and SHA-512 checksum; and
  - critical frontend control tests do not return to fragile exact-call assertions.
- Expanded `npm run check` to run release validation, strict TypeScript checking, all tests, the production build and browser JavaScript syntax validation.
- The Dockerfile now runs the complete `npm run check` quality gate inside the image build instead of only compiling TypeScript.
- The GitHub release workflow now runs a dedicated verification job before QEMU setup and multi-architecture image publication.
- Shell scripts are syntax-checked in both CI and the release workflow.

## Safe versioning

Added:

```bash
npm run version:set -- <major.minor.patch>
```

The command updates only the SALTA root version fields and known release surfaces. It does not perform global version replacement inside `package-lock.json`, preventing accidental modification of unrelated dependency versions, tarball URLs or integrity checksums.

## Compatibility

- No database migration is required.
- No new environment variables are required.
- No runtime application behavior changed.
- Room-grouped overview controls from v0.7.11 remain unchanged.
- HomeMatic thermostat Off, Manual and Automatic controls remain unchanged.
- Existing Shelly, Zigbee, OpenCCU, HomeKit and PostgreSQL configurations remain compatible.

## Verification

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
sh -n install.sh update.sh backup.sh restore.sh
```

## Container tags

```text
0.7.12
0.7
latest
```

## Git tag

```text
v0.7.12
```
