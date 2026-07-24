# SALTA v0.7.2 – Git and Release Commands

Run these commands from the repository root after replacing the local files with the v0.7.2 package.

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git status
git add -A
git commit -m "fix: reuse OpenCCU sessions and handle session limit"
git push origin main
```

## Create and push the release tag

```bash
git tag -a v0.7.2 -m "SALTA v0.7.2"
git push origin v0.7.2
```

## Create the GitHub release

Place `SALTA-v0.7.2.zip` in the repository root or adjust the file path.

```bash
gh release create v0.7.2 \
  --title "SALTA v0.7.2" \
  --notes-file RELEASE_TEXT.md \
  ./SALTA-v0.7.2.zip
```
