# SALTA v0.8.78 release manifest

This manifest is intended for post-push verification before tagging the release.

## Production deployment file

```text
docker-compose.image.yml  SHA-256  c622495a8e167ee3c9abd17f2789213504fddac0eaff15a54e269278299cfb69
```

Required topology:

- SALTA uses `network_mode: host`.
- PostgreSQL uses Docker's normal bridge network.
- PostgreSQL is published only on `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`.
- No custom `networks:` section or `internal: true` network exists in the production Compose file.


## OpenCCU realtime callback contract

```text
SALTA callback listener: TCP 18099
Classic BidCos-RF XML-RPC: TCP 2001
```

The callback listener is bound to the SALTA host address used to reach OpenCCU. The OpenCCU host must be able to connect back to SALTA on TCP `18099`. No Docker port publication is required because the production SALTA service uses `network_mode: host`.

## Legacy HomeKit migration helper

```text
migrate-homekit-storage.sh  SHA-256  c85ff3535b9d3f81b9a0eba1bcfbec18dd530ab63816c12a87b593fa8aeb1d20
```

Production host path:

```text
/opt/SALTA/migrate-homekit-storage.sh
```

This helper is only required for HomeKit pairing state created before v0.8.41.
