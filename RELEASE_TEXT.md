# SALTA v0.8.34

SALTA v0.8.34 hardens the deployment and CI contract after the v0.8.33 GitHub build revealed that `update.sh` was missing from the repository checkout while the deployment test attempted to read it during suite initialization.

## Deployment script contract

- `install.sh`, `update.sh`, `backup.sh` and `restore.sh` are explicit required production release files.
- `docker-compose.image.yml` and `.env.example` are also part of the required deployment-file contract.
- `npm run validate:release` now fails immediately if any required deployment file is missing.
- The production updater remains `update.sh` and continues to use only the standalone `docker-compose.image.yml` deployment.

## Clearer deployment regression tests

- `deployment-config.test.ts` no longer blindly calls `readFileSync()` for deployment files while the test module is loading.
- Required files are checked explicitly with a dedicated regression assertion.
- Missing files therefore produce a clear test failure identifying the missing path instead of aborting the entire suite with an `ENOENT` exception.
- Existing checks for the standalone production Compose file, mandatory secrets, fresh installs, update operations, backups and restores remain in place.

## Faster CI failure for missing deployment files

- CI now validates the presence and shell syntax of all required deployment scripts immediately after checkout.
- The release workflow performs the same early validation before installing npm dependencies or running the full quality gate.
- A missing deployment script now fails with a GitHub Actions error such as `Required deployment script is missing` and identifies the affected file.
- This avoids spending time on `npm ci`, TypeScript compilation and hundreds of tests when the checked-out release source is already incomplete.

## Existing functionality retained

- Keeps the compact Overview heating-mode and battery-warning cards from v0.8.33.
- Keeps the SALTA-only Summer/Winter thermostat mode outside HomeKit.
- Keeps the persistent seven-day Pushover battery-warning cooldown.
- Keeps per-device HomeKit publication and SALTA-room inheritance.
- Keeps the optimized build/test pipeline and AST-based frontend regression checks introduced in v0.8.33.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No runtime API or persistence format is changed.
- Existing Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, FRITZ!Box Presence, HomeKit, climate-mode, battery-warning, Pushover, virtual-device and automation functionality remains unchanged.

## Security and dependencies

- No production or development npm dependency was added or intentionally changed in v0.8.34.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains patched `fast-uri` `3.1.5` and `4.1.2`.
- Retains PostCSS `8.5.23`.
- Retains `find-my-way` `9.7.0`.
- Retains `@homebridge/dbus-native` `0.7.7`.

## Container tags

```text
0.8.34
0.8
latest
```

## Git tag

```text
v0.8.34
```
