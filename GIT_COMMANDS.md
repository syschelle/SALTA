# SALTA v0.8.115 Git commands

## Integrate the validated release branch

The complete validated v0.8.115 release is on `work/v0.8.115-automation-diagnostics` as one clean commit based directly on the current `main`.

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git merge --ff-only origin/work/v0.8.115-automation-diagnostics

npm ci
npm run check

git push origin main
```

Only continue after the complete local `npm run check` is green and the push to `main` has completed.

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json | grep -F '"version": "0.8.115"'
git show origin/main:public/automation-ui.js | grep -F 'copyAutomationWorkflow'
git show origin/main:src/automations.ts | grep -F 'AUTOMATION_EXECUTION_STARTED'
git show origin/main:src/openccu-adapter.ts | grep -F 'OPENCCU_COMMAND_APPLIED'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.115'
```

Wait for GitHub CI and CodeQL on `main` to be green before tagging.

## Tag and push release tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.115 -m "SALTA v0.8.115"
git push origin v0.8.115
```

## GitHub Release

```bash
gh release create v0.8.115 \
  --title "SALTA v0.8.115" \
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

## Branch cleanup

The temporary preparation branches can be deleted once you have integrated the validated work branch:

```bash
git push origin --delete DO-NOT-USE
git push origin --delete build/v0.8.115
git push origin --delete build/v0.8.115-automation-diagnostics
git push origin --delete build/v0.8.115-automation-diagnostics-prep
git push origin --delete build/v0.8.115-final
```

Keep `work/v0.8.115-automation-diagnostics` until v0.8.115 is on `main`, CI/CodeQL are green, tag `v0.8.115` is pushed, and the GitHub release exists. Then remove it:

```bash
git push origin --delete work/v0.8.115-automation-diagnostics
git fetch --prune
```
