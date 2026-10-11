# SALTA v0.8.103 release manifest

This manifest is intended for post-push verification before tagging the release.

## Security dependency baseline

```text
fastify       5.12.5
fast-uri      3.1.8 / 4.2.2
vitest        4.1.11
@vitest/mocker 4.1.11
source-map-js 1.2.2
tinypool      not present
```

## Production deployment file

```text
docker-compose.image.yml  SHA-256  9c98f9f0ac338b822b86dbe9ebe17da969291dea170c2bbe91ecfe5543f51f6a
```

Required topology:

- SALTA uses `network_mode: host`.
- PostgreSQL uses Docker's normal bridge network.
- PostgreSQL is published only on `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`.
- No custom `networks:` section or `internal: true` network exists in the production Compose file.

## Legacy HomeKit migration helper

```text
migrate-homekit-storage.sh  SHA-256  c85ff3535b9d3f81b9a0eba1bcfbec18dd530ab63816c12a87b593fa8aeb1d20
```

Production host path:

```text
/opt/SALTA/migrate-homekit-storage.sh
```

This helper is only required for HomeKit pairing state created before v0.8.41.
