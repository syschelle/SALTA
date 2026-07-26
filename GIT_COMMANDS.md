# SALTA v0.7.7 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the v0.7.7 package.

## Verify the prepared source

```bash
npm ci --no-audit --no-fund
npm ls find-my-way --all
npm run check
```

`npm ls` must report only `find-my-way@9.7.0`.

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git status
git add -A
git commit -m "fix(security): update find-my-way to 9.7.0"
git push origin main
```

## Create and push the release tag

```bash
git tag -a v0.7.7 -m "SALTA v0.7.7"
git push origin v0.7.7
```

## Create the GitHub release

Place `SALTA-v0.7.7.zip` in the repository root or adjust the file path.

```bash
gh release create v0.7.7 \
  --title "SALTA v0.7.7" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.7.7.zip \
  ./SALTA-v0.7.7.zip.sha256
```

## Deploy the published image

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.7.7
```

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
