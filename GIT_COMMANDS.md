# SALTA v0.8.99 Git commands

## Local quality gate

```bash
npm ci
npm run check
```

Only continue with tagging after the complete `npm run check`, GitHub CI and CodeQL are green.

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(automations): add timed Shelly actions"
git push origin main
```

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json | grep -F '"version": "0.8.99"'

git show origin/main:src/automations.ts \
  | grep -F '"turnOnForSeconds"'

git show origin/main:src/shelly-adapter.ts \
  | grep -F 'params.toggle_after = timedSeconds'

git show origin/main:src/shelly-adapter.ts \
  | grep -F '&timer=${timedSeconds}'

git show origin/main:src/db.ts \
  | grep -F 'CREATE TABLE IF NOT EXISTS automation_timed_actions'

git show origin/main:docker-compose.image.yml \
  | grep -F 'ghcr.io/syschelle/salta:0.8.99'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.99 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.99.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.99 -m "SALTA v0.8.99"
git push origin v0.8.99
```

## GitHub Release

```bash
gh release create v0.8.99 \
  --title "SALTA v0.8.99" \
  --notes-file RELEASE_TEXT.md
```

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Never use `docker compose down -v`; keep the existing PostgreSQL and SALTA runtime volumes.
