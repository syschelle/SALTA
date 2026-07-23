# SALTA Security

SALTA uses mandatory authentication and is designed to fail closed when required secrets or security settings are missing. This document describes the protections implemented by SALTA and the limits of those protections.

## Network exposure and HTTPS

SALTA does not terminate TLS itself.

Direct HTTP access is technically supported on trusted local networks, but HTTP does not encrypt passwords, session cookies, device credentials or device data in transit. Internet-facing installations and access across untrusted networks must therefore use an HTTPS reverse proxy.

When a reverse proxy is used, set `TRUSTED_PROXIES` to the exact proxy IP address or the smallest required CIDR. SALTA rejects forwarded headers when no trusted proxy is configured.

Example:

```env
TRUSTED_PROXIES=172.20.0.5
```

The reverse proxy must send the original protocol, normally with `X-Forwarded-Proto: https`. SALTA sets the session cookie `Secure` attribute and the HSTS header only when the request is recognized as HTTPS.

When the reverse proxy runs on the Docker host, keep the published SALTA port on loopback where possible:

```env
SALTA_BIND_ADDRESS=127.0.0.1
```

For direct LAN access without a reverse proxy, `SALTA_BIND_ADDRESS=0.0.0.0` publishes SALTA on all host interfaces. Restrict access with the host firewall and use only trusted networks.

## Authentication and browser sessions

- `ADMIN_PASSWORD` is mandatory, must contain at least 16 characters and must not use a placeholder value.
- Browser logins receive a random opaque server-side session token.
- Session state is stored only in the SALTA process memory.
- The session cookie is `HttpOnly` and `SameSite=Strict`.
- The cookie receives the `Secure` attribute only for requests recognized as HTTPS.
- State-changing browser requests require a matching CSRF token.
- State-changing requests from non-local clients also require a matching request origin.
- Sessions expire after `SESSION_TTL_MINUTES` and are invalidated when SALTA restarts.
- Failed login attempts are rate-limited and temporarily blocked by client IP.

Because sessions and login-block state are process-local, restarting SALTA clears active sessions and current login blocks.

## Direct API access

Local scripts may use HTTP Basic authentication only when all of the following conditions are met:

- the direct client address matches `LOCAL_NETWORKS`;
- the request does not contain forwarded proxy headers; and
- the configured SALTA administrator credentials are supplied.

Basic authentication is only Base64 encoded and is not encrypted. Do not use it over untrusted or unencrypted networks. Prefer HTTPS even for local API clients.

Basic authentication through a reverse proxy is intentionally rejected. Remote browser access uses the authenticated SALTA session together with same-origin and CSRF validation.

Keep `LOCAL_NETWORKS` as narrow as practical. For example, a single LAN can be configured as:

```env
LOCAL_NETWORKS=127.0.0.0/8,192.168.178.0/24,::1/128
```

## Reverse-proxy trust

`TRUSTED_PROXIES` controls whether Fastify accepts forwarded client and protocol information. Configure only addresses belonging to proxies you operate.

Do not add broad private-network ranges merely for convenience. Trusting an unnecessary proxy range can allow another host in that range to influence the derived client address or protocol.

If forwarded headers reach SALTA while `TRUSTED_PROXIES` is empty, SALTA rejects the request instead of trusting those headers.

## Abuse and denial-of-service controls

SALTA applies application-layer controls including:

- per-client request limits;
- a global request limit;
- stricter limits for state-changing requests;
- dedicated low limits for Shelly discovery and onboarding, Phoscon pairing, and adapter reconciliation;
- login-failure limits and temporary IP blocks;
- connection, request, header and keep-alive limits;
- a 32 KiB request-body limit; and
- structured security warnings with sensitive request headers redacted from logs.

The custom request and login limits are stored in process memory. They are reset when SALTA restarts and are not shared between multiple SALTA instances. These controls do not replace firewall rules, reverse-proxy limits or network/TLS-layer denial-of-service protection.

## Browser security headers

SALTA sends browser security headers including:

- Content Security Policy;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: no-referrer`;
- restrictive Permissions Policy;
- same-origin opener and resource policies; and
- HSTS for requests recognized as HTTPS.

Authenticated and HTML responses are marked `Cache-Control: no-store` where appropriate.

## Internal health endpoint

The Docker health endpoint requires `SALTA_HEALTH_TOKEN`. Invalid requests receive a not-found response so the protected endpoint is not exposed as an unauthenticated status API.

`SALTA_HEALTH_TOKEN` is mandatory, must contain at least 32 characters and must not use a placeholder value.

## Docker isolation

PostgreSQL is connected only to the internal `backend` Docker network and does not publish port 5432 to the host. Do not add a PostgreSQL `ports:` entry unless external database access is deliberately required and separately secured.

The SALTA container:

- drops all Linux capabilities;
- enables `no-new-privileges`;
- limits the process count;
- uses an init process; and
- mounts `/tmp` as a writable, size-limited `tmpfs` with `noexec` and `nosuid`.

The container root filesystem is not currently configured as read-only. The `/tmp` restriction should therefore not be described as a read-only filesystem control.

## Secrets and backups

Keep `.env` mode `0600`, store backups securely and never commit `.env` to the repository.

`install.sh` generates random values for:

- the PostgreSQL password;
- the administrator password;
- `SALTA_HEALTH_TOKEN`; and
- `SALTA_ENCRYPTION_KEY`.

Keep `SALTA_ENCRYPTION_KEY` stable for the lifetime of the installation and include it in protected backups. Changing or losing it makes stored Shelly credentials and the Phoscon API key unreadable.

The Phoscon base address and encrypted API key are stored in PostgreSQL. Treat the API key as a password: do not place it in URLs, logs, screenshots or repository files. SALTA connects directly to the configured gateway address, so expose the deCONZ REST API only on trusted local networks and keep the gateway software updated.

The PostgreSQL password must continue to match the existing database volume. Do not rotate it by editing only `.env`.

## Scope and limitations

SALTA security controls protect the application boundary, but they cannot secure compromised Docker hosts, reverse proxies, local networks, Shelly devices or the Phoscon/deCONZ gateway. Keep the host operating system, Docker engine, proxy, gateway and device firmware updated, restrict network access and review logs for repeated authentication or rate-limit warnings.
