# SALTA v0.8.113 Git commands

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
git commit -m "feat(automations): add run-now and duplicate controls"
git push origin main
```

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json | grep -F '"version": "0.8.113"'
git show origin/main:src/automations.ts | grep -F 'triggerManually(id: string): Promise<void>'
git show origin/main:src/server.ts | grep -F '"/api/automations/:id/trigger"'
git show origin/main:public/automation-ui.js | grep -F 'async function triggerAutomation(id)'
git show origin/main:public/automation-ui.js | grep -F 'async function duplicateAutomation(id)'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.113'
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.113 -m "SALTA v0.8.113"
git push origin v0.8.113
```

## GitHub Release

```bash
gh release create v0.8.113 \
  --title "SALTA v0.8.113" \
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

Do not use `docker compose down -v`.
