# SALTA v0.8.57 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(automation): expose legacy virtual targets"
git push origin main
```

Wait for CI and both CodeQL jobs to complete successfully before tagging.

## Verify pushed release candidate

```bash
git fetch origin
git show origin/main:package.json | grep '"version"'
git show origin/main:docker-compose.image.yml | sha256sum
git show origin/main:migrate-homekit-storage.sh | sha256sum
git show origin/main:public/automation-ui.js | grep -F "const binaryFallback=device.source==='virtual'||"
git show origin/main:src/automations.ts | grep -F 'if (device.source === "virtual") return true;'
```

Expected validator output:

```text
Release validator contract: SALTA v0.8.57 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.57.
```

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.57 -m "SALTA v0.8.57"
git push origin v0.8.57
```

## Optional GitHub Release

```bash
gh release create v0.8.57 \
  --title "SALTA v0.8.57" \
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

Never use `down -v` for a normal update.
