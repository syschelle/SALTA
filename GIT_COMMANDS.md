# SALTA v0.8.101 Git commands

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
git commit -m "feat(presence): add fixed-IP recovery and MAC refresh"
git push origin main
```

## Post-push verification

```bash
git fetch origin

git show origin/main:package.json \
  | grep -F '"version": "0.8.101"'

git show origin/main:src/db.ts \
  | grep -F 'CREATE TABLE IF NOT EXISTS presence_target_network'

git show origin/main:src/fritzbox-presence.ts \
  | grep -F 'X_AVM-DE_GetSpecificHostEntyByIP'

git show origin/main:src/fritzbox-presence.ts \
  | grep -F 'FRITZBOX_PRESENCE_MAC_UPDATED'

git show origin/main:src/fritzbox-presence.ts \
  | grep -F 'updatePresenceTargetMacAddress'

git show origin/main:public/index.html \
  | grep -F 'id="presenceTargetIp"'

git show origin/main:src/fritzbox-presence.test.ts \
  | grep -F 'updates a changed iPhone MAC from the configured fixed IP during reconciliation'

git show origin/main:docker-compose.image.yml \
  | grep -F 'ghcr.io/syschelle/salta:0.8.101'
```

Then run the complete local quality gate again if the push came from a different checkout:

```bash
npm ci
npm run check
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.101 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.101.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main
git fetch origin

git tag -a v0.8.101 -m "SALTA v0.8.101"
git push origin v0.8.101
```

## GitHub Release

```bash
gh release create v0.8.101 \
  --title "SALTA v0.8.101" \
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
