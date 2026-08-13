# SALTA v0.8.38 Git commands

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(overview): add compact daylight status card"
git push origin main
```

After CI and CodeQL are green:

```bash
git tag -a v0.8.38 -m "SALTA v0.8.38"
git push origin v0.8.38
```
