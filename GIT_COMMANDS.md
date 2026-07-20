# SALTA v0.4.6 – Git and Release Commands

## 1. Prepare and verify the repository

```bash
git checkout main
git pull --ff-only origin main
git status
npm ci
npm run check
```

## 2. Commit and push v0.4.6

```bash
git add .
git commit -m "release: SALTA v0.4.6"
git push origin main
```

## 3. Create and push the release tag

```bash
git tag -a v0.4.6 -m "SALTA v0.4.6"
git push origin v0.4.6
```

Pushing `v0.4.6` triggers `.github/workflows/release.yml` and publishes the multi-architecture GHCR package.

Expected image tags:

```text
ghcr.io/syschelle/salta:0.4.6
ghcr.io/syschelle/salta:0.4
ghcr.io/syschelle/salta:latest
```

## 4. Create the GitHub release

```bash
gh release create v0.4.6 \
  --title "SALTA v0.4.6" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.4.6.zip
```

## 5. Deploy the published image

Set the desired image in `.env`:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.6
```

Then deploy:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
curl -s http://127.0.0.1:8099/api/health
```

## 6. Final verification

```bash
git show v0.4.6 --no-patch
git ls-remote --tags origin refs/tags/v0.4.6
gh release view v0.4.6
```
