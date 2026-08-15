# SALTA v0.8.54 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(automation): support multiple target actions"
git push origin main
```

## Verify the pushed repository before tagging

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:docker-compose.image.yml | sha256sum
git show origin/main:migrate-homekit-storage.sh | sha256sum
git show origin/main:src/db.ts | grep -F 'CREATE TABLE IF NOT EXISTS automation_actions'
git show origin/main:public/index.html | grep -F 'id="automationAddActionButton"'
git show origin/main:public/automation-ui.js | grep -F 'additionalActions:automationAdditionalActionPayload()'
```

Compare the SHA-256 values with `RELEASE_MANIFEST.md` from the same commit.

## Verify before tagging

```bash
npm ci
npm run check
```

The validator output must include:

```text
Release validator contract: SALTA v0.8.54 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.54.
```

Wait for GitHub CI and both CodeQL analyses to be completely green on `main`.

## Tag and publish

Only after the repository verification above matches the release candidate:

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.54 -m "SALTA v0.8.54"
git push origin v0.8.54
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

Do not use `down -v`. No manual database migration is required; the additive `automation_actions` table is created by normal schema initialization.
