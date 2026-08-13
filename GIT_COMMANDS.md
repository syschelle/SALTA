# SALTA v0.8.30 Git commands

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(tests): align device config checks with HomeKit fields"
git push origin main
```

After CI and CodeQL are green:

```bash
git tag -a v0.8.30 -m "SALTA v0.8.30"
git push origin v0.8.30
```
