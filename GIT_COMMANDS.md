# SALTA v0.7.10 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the complete v0.7.10 package.

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
git commit -m "fix(openccu): enable displayed thermostat modes"
git push origin main
```

## Tag and publish

```bash
git tag -a v0.7.10 -m "SALTA v0.7.10"
git push origin v0.7.10
```

## Create the GitHub release

```bash
gh release create v0.7.10 \
  --title "SALTA v0.7.10" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.7.10.zip \
  ./SALTA-v0.7.10.zip.sha256
```

## Deploy the published image

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.7.10
```

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

After deployment, open the HomeMatic page and click **Synchronize** once.
