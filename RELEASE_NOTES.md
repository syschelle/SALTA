# SALTA v0.4.28

SALTA v0.4.28 hardens the web application for authenticated HTTPS reverse-proxy deployments and isolates PostgreSQL inside Docker.

## Security Highlights

- Mandatory authentication for the complete web application
- Dedicated login page with opaque server-side sessions
- `HttpOnly` and `SameSite=Strict` session cookies
- Secure cookies and HSTS when requests arrive through HTTPS
- CSRF protection for state-changing browser requests
- Local-network-only HTTP Basic access for direct API clients
- Remote JSON access accepted only through an authenticated same-origin browser session
- Login brute-force protection and temporary blocking
- Per-client, mutation, expensive-route and global request limits
- Structured rate-limit and failed-login security logging
- Security headers and restricted browser capabilities
- Request body, header, connection and keep-alive limits

## Docker Isolation

PostgreSQL no longer publishes a host port. It is connected only to an `internal: true` Docker backend network shared with SALTA.

SALTA uses a separate frontend network for the web service and outbound access to local Shelly devices.

The SALTA container also uses:

- an unprivileged runtime user
- `no-new-privileges`
- all Linux capabilities dropped
- a PID limit
- a restricted temporary filesystem

## Health Checks

`/api/health` and `/api/readiness` require authentication.

Docker uses a separate `/internal/health` endpoint protected by the generated `SALTA_HEALTH_TOKEN`. Invalid requests receive a generic 404 response.

## Reverse Proxy

Configure `TRUSTED_PROXIES` with the exact IP address or CIDR of the reverse proxy. SALTA does not trust forwarded client or protocol headers by default.

```env
TRUSTED_PROXIES=172.20.0.0/24
```

## Updating

No database migration is required. Existing `.env` files require a new health token. `update.sh` generates it automatically when missing.

Keep the existing `SALTA_ENCRYPTION_KEY` unchanged.

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.28
```

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Container Tags

```text
0.4.28
0.4
latest
```

## Git Tag

```text
v0.4.28
```
