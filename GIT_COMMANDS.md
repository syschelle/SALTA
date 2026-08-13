# SALTA v0.8.32 Git commands

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(tests): validate climate button bindings in HTML"
git push origin main
```

After CI and CodeQL are green:

```bash
git tag -a v0.8.32 -m "SALTA v0.8.32"
git push origin v0.8.32
```
