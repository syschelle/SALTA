# SALTA v0.7.11 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the complete v0.7.11 package.

## Verify

```bash
git status
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm ls @homebridge/dbus-native find-my-way --all
npm run check
```

Expected dependency versions:

```text
@homebridge/dbus-native@0.7.7
find-my-way@9.7.0
```

## Commit and push

```bash
git add -A
git commit -m "feat(overview): group room devices on dashboard"
git push origin main
```

## Tag and publish

```bash
git tag -a v0.7.11 -m "SALTA v0.7.11"
git push origin v0.7.11
```

## Create the GitHub release

```bash
gh release create v0.7.11 \
  --title "SALTA v0.7.11" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.7.11.zip \
  ./SALTA-v0.7.11.zip.sha256
```

## Deploy the published image

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.7.11
```

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
