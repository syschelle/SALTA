# SALTA v0.7.12 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the complete v0.7.12 package.

## Verify

```bash
git status
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
sh -n install.sh update.sh backup.sh restore.sh
npm ls @homebridge/dbus-native find-my-way --all
```

Expected dependency versions:

```text
@homebridge/dbus-native@0.7.7
find-my-way@9.7.0
```

## Commit and push

```bash
git add -A
git commit -m "fix(build): harden release quality gates"
git push origin main
```

Wait for the `CI` workflow on `main` to finish successfully before creating the release tag.

## Tag and publish

```bash
git tag -a v0.7.12 -m "SALTA v0.7.12"
git push origin v0.7.12
```

The release workflow runs the complete verification job again before it starts the multi-architecture Docker build.

## Create the GitHub release

```bash
gh release create v0.7.12 \
  --title "SALTA v0.7.12" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.7.12.zip \
  ./SALTA-v0.7.12.zip.sha256
```

## Deploy the published image

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.7.12
```

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

## Future safe version bump

```bash
npm run version:set -- 0.7.13
npm run check
```
