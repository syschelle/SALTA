# SALTA v0.8.45 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(test): stabilize HomeKit command-dispatch regression coverage"
git push origin main
```

## Verify before tagging

```bash
npm ci
npm run check
```

The validator output must include:

```text
Release validator contract: SALTA v0.8.45 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.45.
```

Wait for GitHub CI and both CodeQL analyses to be completely green on `main`.

## Tag and publish

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.45 -m "SALTA v0.8.45"
git push origin v0.8.45
```

## Production update after the release image is available

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Updating from v0.8.43 or the unreleased v0.8.44 candidate does not require the legacy HomeKit storage migration.
