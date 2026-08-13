# SALTA v0.8.29 Git commands

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(homekit): add per-device publication and room inheritance"
git push origin main
```

After CI and CodeQL are green:

```bash
git tag -a v0.8.29 -m "SALTA v0.8.29"
git push origin v0.8.29
```
