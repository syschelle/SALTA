# SALTA v0.8.111 Git commands

## Local quality gate

```bash
npm ci
npm run check
```

Only continue after the complete `npm run check` is green.

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(automations): correct sequence TypeScript narrowing"
git push origin main
```

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json | grep -F '"version": "0.8.111"'
git show origin/main:src/automations.ts | grep -F 'const sequence: AutomationSequenceStep[] | undefined'
git show origin/main:src/automations.ts | grep -F 'map((step): AutomationSequenceStep =>'
git show origin/main:src/server.ts | grep -F 'const primaryDeviceId = sequencePrimary?.deviceId ?? data.actionDeviceId'
git show origin/main:src/server.ts | grep -F 'const primaryAction = sequencePrimary?.action ?? data.action'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.111'
```

Then run the complete quality gate again if the push came from a different checkout:

```bash
npm ci
npm run check
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.111 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.111.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.111 -m "SALTA v0.8.111"
git push origin v0.8.111
```

## GitHub Release

```bash
gh release create v0.8.111 \
  --title "SALTA v0.8.111" \
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
