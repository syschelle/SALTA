# SALTA v0.7.1 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the v0.7.1 package.

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git status
git add -A
git commit -m "feat: add OpenCCU diagnostics and system log"
git push origin main
```

## Create and push the release tag

```bash
git tag -a v0.7.1 -m "SALTA v0.7.1"
git push origin v0.7.1
```

## Create the GitHub release

Place `SALTA-v0.7.1.zip` in the repository root or adjust the file path.

```bash
gh release create v0.7.1 \
  --title "SALTA v0.7.1" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.7.1.zip
```
