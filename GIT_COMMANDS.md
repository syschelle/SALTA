# SALTA v0.8.103 Git commands

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
git commit -m "chore(security): refresh vulnerable npm dependencies"
git push origin main
```

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json | grep -F '"version": "0.8.103"'
git show origin/main:package.json | grep -F '"fastify": "^5.12.5"'
git show origin/main:package.json | grep -F '"vitest": "^4.1.11"'

git show origin/main:package-lock.json | grep -F '"version": "5.12.5"'
git show origin/main:package-lock.json | grep -F '"version": "3.1.8"'
git show origin/main:package-lock.json | grep -F '"version": "4.2.2"'
git show origin/main:package-lock.json | grep -F '"version": "4.1.11"'
git show origin/main:package-lock.json | grep -F '"version": "1.2.2"'

if git show origin/main:package-lock.json | grep -Fq '"node_modules/tinypool"'; then
  echo "Review Tinypool version before tagging"
  exit 1
fi

git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.103'
```

Then run the complete quality gate again if the push came from a different checkout:

```bash
npm ci
npm run check
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.103 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.103.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.103 -m "SALTA v0.8.103"
git push origin v0.8.103
```

## GitHub Release

```bash
gh release create v0.8.103 \
  --title "SALTA v0.8.103" \
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
