# SALTA v0.8.114 Git commands

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
git commit -m "fix(openccu): isolate thermostat target-temperature writes"
git push origin main
```

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json | grep -F '"version": "0.8.114"'
git show origin/main:src/openccu-core.ts | grep -F 'parameter: targetParameter'
git show origin/main:src/openccu-v08114-regression.test.ts | grep -F 'changes only SET_TEMPERATURE while classic HomeMatic is in manual mode'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.114'
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag and push release tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.114 -m "SALTA v0.8.114"
git push origin v0.8.114
```

## GitHub Release

```bash
gh release create v0.8.114 \
  --title "SALTA v0.8.114" \
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

Delete the work branch only after v0.8.114 is on `main`, CI/CodeQL are green, tag `v0.8.114` has been pushed, and the GitHub release exists:

```bash
git checkout main
git pull --ff-only origin main
git fetch --prune

git push origin --delete work/v0.8.114-thermostat-manual-setback
git branch -d work/v0.8.114-thermostat-manual-setback
git fetch --prune
```
