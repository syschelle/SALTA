# SALTA v0.8.53 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(homekit): improve settings and device publishing"
git push origin main
```

## Verify the pushed repository before tagging

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:docker-compose.image.yml | sha256sum
git show origin/main:migrate-homekit-storage.sh | sha256sum
git show origin/main:public/index.html | grep -F 'id="homeKitDeviceList"'
git show origin/main:public/styles.css | grep -F '.homekit-pairing-box[hidden]{display:none}'
```

Compare the SHA-256 values with `RELEASE_MANIFEST.md` from the same commit.

## Verify before tagging

```bash
npm ci
npm run check
```

The validator output must include:

```text
Release validator contract: SALTA v0.8.53 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.53.
```

Wait for GitHub CI and both CodeQL analyses to be completely green on `main`.

## Tag and publish

Only after the repository verification above matches the release candidate:

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.53 -m "SALTA v0.8.53"
git push origin v0.8.53
```

## Production update after the release image is available

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `down -v`. No database migration is required.
