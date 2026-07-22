# SALTA v0.5.4

SALTA v0.5.4 corrects and expands the security documentation so it accurately reflects the protections and limitations implemented by the application and Docker deployment.

## Security documentation

- Clarified that SALTA does not terminate TLS itself
- Documented that direct HTTP access is supported only as an unencrypted option for trusted local networks
- Specified that Internet-facing and otherwise untrusted access must use an HTTPS reverse proxy
- Documented how `TRUSTED_PROXIES` affects forwarded client information, HTTPS recognition, Secure session cookies and HSTS
- Clarified that direct Basic authentication is accepted only from `LOCAL_NETWORKS` and only when no forwarded proxy headers are present
- Added an explicit warning that Basic authentication is not encrypted without HTTPS
- Added guidance to keep `LOCAL_NETWORKS` and `TRUSTED_PROXIES` as narrow as practical
- Documented that sessions, login blocks and custom application rate limits are stored in process memory and reset when SALTA restarts
- Corrected the Docker filesystem description: `/tmp` is writable and size-limited with `noexec` and `nosuid`; the container root filesystem is not read-only
- Documented browser security headers, protected health-check behavior, secret handling and the limits of application-layer protections

## Runtime behavior

- No application behavior changed
- No API behavior changed
- No database schema changed
- No environment or Docker Compose changes are required
- No clean reinstall is required when updating from an existing v0.5 installation

## Updating

```bash
./update.sh
```

For a new installation:

```bash
./install.sh --fresh
```

## Container tags

```text
0.5.4
0.5
latest
```

## Git tag

```text
v0.5.4
```
