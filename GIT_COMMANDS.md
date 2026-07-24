# SALTA v0.7.3 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the v0.7.3 package.

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git status
git add -A
git commit -m "fix: reconnect OpenCCU and synchronize device names"
git push origin main
```

## Create and push the release tag

```bash
git tag -a v0.7.3 -m "SALTA v0.7.3"
git push origin v0.7.3
```

## Create the GitHub release

Place `SALTA-v0.7.3.zip` in the repository root or adjust the file path.

```bash
gh release create v0.7.3 \
  --title "SALTA v0.7.3" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.7.3.zip
```
