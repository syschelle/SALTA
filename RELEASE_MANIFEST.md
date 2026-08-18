# SALTA v0.8.91 release manifest

This manifest is intended for post-push verification before tagging the release.

## Production deployment file

```text
docker-compose.image.yml  SHA-256  33a20a66ab80e156e30a7d6006bbd7555f1a5f309a2422578bf347a3a58aa8b2
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
