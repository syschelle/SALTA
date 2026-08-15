# SALTA v0.8.67 release manifest

This manifest is intended for post-push verification before tagging the release.

## Production deployment file

```text
docker-compose.image.yml  SHA-256  f899b99629ce31a6c85ec45ba01883a13944c0e0694eb094468a04d6a4b4cd09
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
