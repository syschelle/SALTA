# SALTA v0.8.4 – Git and Release Commands

## Commit and verify on main

```bash
git checkout main
git pull --ff-only origin main

git status
git add -A
git commit -m "fix(ci): make automation mobile CSS tests media-aware"
git push origin main
```

Wait for the complete GitHub CI workflow on `main` to finish successfully before creating the release tag.

## Create and push the release tag

```bash
git tag -a v0.8.4 -m "SALTA v0.8.4"
git push origin v0.8.4
```

## Optional GitHub CLI release

```bash
gh release create v0.8.4 \
  --title "SALTA v0.8.4" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.8.4.zip \
  ./SALTA-v0.8.4.zip.sha256
```

## Production update

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
