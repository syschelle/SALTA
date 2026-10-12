# SALTA v0.8.116 Git commands

## Integrate the validated work branch

The complete v0.8.116 release is prepared on `work/v0.8.116-automation-execution-diagnostics`. GitHub Actions is the authoritative quality gate; no local npm commands are required.

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git merge --ff-only origin/work/v0.8.116-automation-execution-diagnostics
git push origin main
```

Wait for GitHub CI and CodeQL on `main` to be green before tagging.

## Post-push verification

```bash
git fetch origin
git show origin/main:package.json | grep -F '"version": "0.8.116"'
git show origin/main:src/automations.ts | grep -F 'executionId = randomUUID()'
git show origin/main:src/openccu-adapter.ts | grep -F 'command.diagnosticContext'
git show origin/main:public/app.js | grep -F 'copyAutomationExecution'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.116'
```

## Tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin
git tag -a v0.8.116 -m "SALTA v0.8.116"
git push origin v0.8.116
```

## GitHub Release

Create the GitHub release for tag `v0.8.116` and paste the release text from the chat.

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

## Branch cleanup

Delete the work branch only after v0.8.116 is on `main`, GitHub CI/CodeQL are green, tag `v0.8.116` is pushed and the GitHub release exists:

```bash
git push origin --delete work/v0.8.116-automation-execution-diagnostics
git fetch --prune
```
