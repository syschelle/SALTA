# SALTA v0.8.28 Git commands

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(shelly): stabilize Gen4 reachability polling"
git push origin main
```

After CI and CodeQL are green:

```bash
git tag -a v0.8.28 -m "SALTA v0.8.28"
git push origin v0.8.28
```
