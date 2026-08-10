# SALTA v0.8.21

SALTA v0.8.21 is a dependency-security release that updates vulnerable transitive `fast-uri` and PostCSS packages detected by GitHub Dependabot.

## fast-uri security updates

- Updated the Fastify/AJV `fast-uri` 3.x dependency from `3.1.4` to `3.1.5`.
- Updated the `fast-json-stringify` nested `fast-uri` 4.x dependency from `4.1.1` to `4.1.2`.
- These versions remediate GHSA-7p8r-x3mc-p8w7 / CVE-2026-18446, a high-severity host-confusion issue involving backslash authority introducers.
- Both vulnerable copies present in the v0.8.20 `package-lock.json` are replaced by patched releases.
- No SALTA source-code behavior or Fastify API is changed by this patch-level dependency update.

## PostCSS security update

- Updated development-only PostCSS from `8.5.20` to `8.5.23` through the existing `vitest -> vite -> postcss` dependency path.
- This remediates GHSA-fxqj-rqcc-2cmp / CVE-2026-69153, the follow-up advisory for incomplete protection against attacker-controlled `sourceMappingURL` file reads when `from` is unset.
- PostCSS remains a development-only dependency in SALTA and is not added to the production dependency set.

## Dependency and release validation

- All direct SALTA dependency ranges remain unchanged.
- Only transitive lockfile package versions, tarball URLs and integrity hashes required for the security fixes were updated.
- Added release-validation checks that reject known-vulnerable `fast-uri` 2.x/3.x/4.x versions and PostCSS releases below `8.5.23` if they are reintroduced into the lockfile.
- Existing `find-my-way` `9.7.0` and `@homebridge/dbus-native` `0.7.7` security/consistency pins remain unchanged.

## Compatibility

- No database migration is required.
- No new database table is required.
- No fresh PostgreSQL volume is required.
- No new environment variable is required.
- No API or UI behavior changes are included.
- Existing FRITZ!Box Presence, Shelly, Phoscon/Zigbee, OpenCCU/HomeMatic, Daylight, virtual-device, automation and HomeKit functionality remains unchanged.

## Container tags

```text
0.8.21
0.8
latest
```

## Git tag

```text
v0.8.21
```
