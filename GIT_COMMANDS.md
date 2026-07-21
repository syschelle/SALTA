# SALTA v0.4.16 – Git and Release Commands

## 1. Prepare and verify

```bash
git checkout main
git pull --ff-only origin main

git status
npm ci
npm run check
node --check public/app.js
sh -n deploy.sh update.sh backup.sh restore.sh
```

## 2. Commit and push v0.4.16

```bash
git add .
git commit -m "release: SALTA v0.4.16"
git push origin main
```

## 3. Create and push the release tag

```bash
git tag -a v0.4.16 -m "SALTA v0.4.16"
git push origin v0.4.16
```

Pushing `v0.4.16` starts `.github/workflows/release.yml` and publishes the multi-architecture container images.

Expected tags:

```text
ghcr.io/syschelle/salta:0.4.16
ghcr.io/syschelle/salta:0.4
ghcr.io/syschelle/salta:latest
```

## 4. Create the GitHub release

Run this command from the directory containing `SALTA-v0.4.16.zip`:

```bash
gh release create v0.4.16 \
  --title "SALTA v0.4.16" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.4.16.zip
```

## 5. Update an installation

Keep the existing `SALTA_ENCRYPTION_KEY` in `.env` unchanged. To pin this release:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.16
```

Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
curl -s http://127.0.0.1:8099/api/health
curl -s http://127.0.0.1:8099/api/readiness
```

## 6. Verify the release

```bash
git show v0.4.16 --no-patch
git ls-remote --tags origin refs/tags/v0.4.16
gh release view v0.4.16
```
