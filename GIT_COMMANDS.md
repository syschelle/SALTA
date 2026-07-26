# SALTA v0.7.8 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the complete v0.7.8 package.

## Verify the prepared source

```bash
npm ci --no-audit --no-fund
npm run check
npm ls find-my-way --all
```

`npm ls` must continue to report only `find-my-way@9.7.0`.

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git status
git add -A
git commit -m "feat(openccu): add thermostat operating modes"
git push origin main
```

## Create and push the release tag

```bash
git tag -a v0.7.8 -m "SALTA v0.7.8"
git push origin v0.7.8
```

## Create the GitHub release

Place `SALTA-v0.7.8.zip` and its checksum file in the repository root or adjust the paths.

```bash
gh release create v0.7.8 \
  --title "SALTA v0.7.8" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.7.8.zip \
  ./SALTA-v0.7.8.zip.sha256
```

## Deploy the published image

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.7.8
```

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

After deployment, open the HomeMatic page and run **Synchronize** once to refresh thermostat control metadata.
