# SALTA v0.8.31 Git commands

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(system): add climate mode and weekly battery alerts"
git push origin main
```

After CI and CodeQL are green:

```bash
git tag -a v0.8.31 -m "SALTA v0.8.31"
git push origin v0.8.31
```
