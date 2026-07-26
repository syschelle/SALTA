# SALTA v0.7.7

SALTA v0.7.7 is a security maintenance release for the HTTP router used by Fastify.

## Security fix

- Updated the transitive `find-my-way` dependency from 9.6.0 to 9.7.0
- Fixed CVE-2026-47219 / GHSA-c96f-x56v-gq3h
- Prevented a remotely triggerable denial-of-service condition when the router is used with a Node.js HTTP/2 server
- Added an exact npm override so local installs, CI and Docker builds cannot resolve to the vulnerable release
- Added regression coverage that verifies the patched dependency remains locked

## Build behavior

The Docker build continues to use `npm ci`. The committed `package-lock.json` now resolves `find-my-way` to 9.7.0, so both `linux/amd64` and `linux/arm64` images install the fixed dependency reproducibly.

## Compatibility

- No application behavior changed
- No API behavior changed
- No database schema changed
- No environment-variable changes are required
- No Docker Compose migration is required
- Existing SALTA configuration and PostgreSQL data remain compatible

## Updating

```bash
./update.sh
```

For a new installation:

```bash
./install.sh
```

## Verification

```bash
npm ci --no-audit --no-fund
npm ls find-my-way --all
npm run check
```

The dependency tree must contain only:

```text
find-my-way@9.7.0
```

## Container tags

```text
0.7.7
0.7
latest
```

## Git tag

```text
v0.7.7
```
