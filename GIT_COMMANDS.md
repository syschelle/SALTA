# SALTA v0.8.109 Git commands

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
git commit -m "feat(automations): move workflow editor to dedicated page"
git push origin main
```

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json | grep -F '"version": "0.8.109"'
git show origin/main:public/index.html | grep -F 'data-page="automation-editor"'
git show origin/main:public/index.html | grep -F 'onclick="openAutomationEditor()"'
git show origin/main:public/index.html | grep -F 'Wartezeit einfügen'
git show origin/main:public/automation-ui.js | grep -F "location.hash='automation-editor'"
git show origin/main:public/app.js | grep -F "'automations','automation-editor','rooms'"
git show origin/main:public/styles.css | grep -F '.automation-editor-form{width:100%;max-width:1120px'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.109'
```

Then run the complete quality gate again if the push came from a different checkout:

```bash
npm ci
npm run check
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.109 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.109.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.109 -m "SALTA v0.8.109"
git push origin v0.8.109
```

## GitHub Release

```bash
gh release create v0.8.109 \
  --title "SALTA v0.8.109" \
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
