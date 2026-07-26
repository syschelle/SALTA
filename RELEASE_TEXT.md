# SALTA v0.7.9

SALTA v0.7.9 is a build-reliability maintenance release for the complete HomeMatic thermostat update delivered in v0.7.8.

## Build fix

- Fixed `npm ci` failing with `EINTEGRITY` for `@homebridge/dbus-native`.
- Restored the package-lock entry to the internally consistent upstream 0.7.7 record.
- Restored the matching tarball URL and SHA-512 integrity checksum.
- Restored the original `@homebridge/hap-nodejs` dependency declaration of `^0.7.7`.
- Added an exact npm override for `@homebridge/dbus-native` 0.7.7 to prevent an accidental lockfile drift.
- Added regression coverage for package version, tarball URL, integrity checksum and parent dependency metadata.

The `q@1.1.2` message remains an upstream deprecation warning inherited through the HomeKit dependency chain. It does not fail the build.

## Included HomeMatic functionality

- **Off**, **Manual** and **Automatic** controls for supported heating and wall thermostats.
- Support for classic HomeMatic `AUTO_MODE` / `MANU_MODE` actions.
- Support for writable Homematic IP mode enums such as `SET_POINT_MODE`.
- Native Off mode when available, with frost-protection fallback for devices without a separate Off mode.

## Security and compatibility

- Retains the `find-my-way` 9.7.0 security override.
- No database migration is required.
- No environment-variable changes are required.
- Existing OpenCCU, Shelly, Zigbee, HomeKit and PostgreSQL configuration remains compatible.

## Verification

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
npm ls @homebridge/dbus-native find-my-way --all
```

The dependency tree must contain:

```text
@homebridge/dbus-native@0.7.7
find-my-way@9.7.0
```

## Container tags

```text
0.7.9
0.7
latest
```

## Git tag

```text
v0.7.9
```
