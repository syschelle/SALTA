# SALTA v0.4.7 – Git and Release Commands

## 1. Prepare and verify

```bash
git checkout main
git pull --ff-only origin main

git status
npm ci
npm run check
```

## 2. Commit and push v0.4.7

```bash
git add .
git commit -m "release: SALTA v0.4.7"
git push origin main
```

## 3. Create and push the release tag

```bash
git tag -a v0.4.7 -m "SALTA v0.4.7"
git push origin v0.4.7
```

Pushing `v0.4.7` starts `.github/workflows/release.yml` and publishes the multi-architecture container images.

Expected tags:

```text
ghcr.io/syschelle/salta:0.4.7
ghcr.io/syschelle/salta:0.4
ghcr.io/syschelle/salta:latest
```

## 4. Create the GitHub release

Run this command from the directory containing `SALTA-v0.4.7.zip`:

```bash
gh release create v0.4.7 \
  --title "SALTA v0.4.7" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.4.7.zip
```

## 5. Update an installation

To pin the release explicitly in `.env`:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.7
```

Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
curl -s http://127.0.0.1:8099/api/health
```

## 6. Verify the release

```bash
git show v0.4.7 --no-patch
git ls-remote --tags origin refs/tags/v0.4.7
gh release view v0.4.7
```
