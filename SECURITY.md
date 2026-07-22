# SALTA Security

## Internet exposure

SALTA must be published only through HTTPS. The application provides its own mandatory login and does not expose the dashboard or REST responses without authentication.

Set `TRUSTED_PROXIES` to the exact IP address or CIDR used by the reverse proxy. This allows SALTA to validate the real client address and HTTPS protocol without trusting spoofed forwarding headers.

Example:

```env
TRUSTED_PROXIES=172.20.0.0/24
```

Keep the host binding on loopback when the reverse proxy runs on the host:

```env
SALTA_BIND_ADDRESS=127.0.0.1
```

## Authentication and sessions

- `ADMIN_PASSWORD` is mandatory and must contain at least 16 characters.
- Browser logins receive a random opaque server-side session.
- The session cookie is `HttpOnly` and `SameSite=Strict`.
- HTTPS requests receive a `Secure` cookie and HSTS.
- State-changing browser requests require a CSRF token.
- Sessions expire after `SESSION_TTL_MINUTES` and are invalidated when SALTA restarts.
- Failed login attempts are rate-limited and temporarily blocked.

## API access

Local scripts may use HTTP Basic authentication only when their client address matches `LOCAL_NETWORKS`.

Remote Basic authentication is rejected. The Internet-facing web application uses the authenticated browser session and same-origin/CSRF validation for its JSON requests. Blocking every JSON endpoint for remote clients would also make the remote web interface unusable.

## Abuse and DoS controls

SALTA enforces:

- per-client request limits
- a global request limit
- stricter mutation limits
- dedicated low limits for Shelly discovery, onboarding and reconciliation
- login failure limits and temporary blocks
- request, connection, header and keep-alive limits
- a 32 KiB request-body limit
- structured security warnings in the application log

These are application-layer protections. Network- or TLS-layer DDoS protection must be provided before traffic reaches SALTA.

## Docker isolation

PostgreSQL is connected only to the internal `backend` Docker network and does not publish port 5432 to the host. SALTA joins both the frontend and backend networks.

Do not add a PostgreSQL `ports:` entry.

## Secrets

Keep `.env` mode `0600`, back it up securely and never commit it. Keep `SALTA_ENCRYPTION_KEY` stable. `install.sh` generates random database, administrator, encryption and health-check secrets for new installations.
