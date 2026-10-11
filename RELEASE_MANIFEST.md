# SALTA v0.8.108 release manifest

This manifest is intended for post-push verification before tagging the release.

## Release focus

- Ordered automation action/wait sequences.
- Wait steps from 1 to 86400 seconds.
- Repeated target devices within one sequence.
- Additive `automation_sequence_steps` persistence with automatic migration of existing v0.8.x automations.
- Configuration/disaster-recovery backup support for sequence steps and compatibility with older format-v1 backups.
- No npm dependency, mandatory environment variable or deployment-topology change.

## Production deployment file

```text
docker-compose.image.yml  SHA-256  a4876cd7d97929cd6077b131942f33ffad906840a42cfa00c2faf147dd889316
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

## Pre-tag gate

Run from the exact v0.8.108 checkout:

```bash
npm ci
npm run check
```

Expected release validator contract:

```text
Release validator contract: SALTA v0.8.108 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.108.
```

Tag only after the local/CI quality gate and CodeQL are green.
