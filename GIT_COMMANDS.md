# SALTA v0.8.52 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(deploy): publish consistent production compose topology"
git push origin main
```

## Verify the pushed repository before tagging

```bash
git fetch origin

git show origin/main:docker-compose.image.yml | sha256sum
git show origin/main:migrate-homekit-storage.sh | sha256sum
git show origin/main:MIGRATION_PATH.md | grep -F '/opt/SALTA/migrate-homekit-storage.sh'
```

Expected SHA-256 values:

```text
docker-compose.image.yml   00456817f9204a8f747e94f507cc32687f8b8f1eb89ee9933412275f3bacb20c
migrate-homekit-storage.sh c85ff3535b9d3f81b9a0eba1bcfbec18dd530ab63816c12a87b593fa8aeb1d20
```

Also verify that the repository Compose contains no retired custom network:

```bash
git show origin/main:docker-compose.image.yml | grep -nE 'backend|internal:|networks:' || true
git show origin/main:docker-compose.image.yml | grep -nE 'network_mode: host|127\.0\.0\.1:.*5433.*5432|0\.8\.52'
```

The first command must produce no output.

## Verify before tagging

```bash
npm ci
npm run check
```

The validator output must include:

```text
Release validator contract: SALTA v0.8.52 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.52.
```

Wait for GitHub CI and both CodeQL analyses to be completely green on `main`.

## Tag and publish

Only after the repository verification above matches the release manifest:

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.52 -m "SALTA v0.8.52"
git push origin v0.8.52
```

## Production update after the release image is available

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `down -v`. No database migration is required. The legacy HomeKit migration helper at `/opt/SALTA/migrate-homekit-storage.sh` is only required for pre-v0.8.41 HomeKit pairing data.
