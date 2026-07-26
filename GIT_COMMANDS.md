# SALTA v0.7.6 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the v0.7.6 package.

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git status
git add -A
git commit -m "test: update slider refresh regression for v0.7.6"
git push origin main
```

## Create and push the release tag

```bash
git tag -a v0.7.6 -m "SALTA v0.7.6"
git push origin v0.7.6
```

## Create the GitHub release

Place `SALTA-v0.7.6.zip` in the repository root or adjust the file path.

```bash
gh release create v0.7.6 \
  --title "SALTA v0.7.6" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.7.6.zip
```
