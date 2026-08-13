# SALTA v0.8.39 Git commands

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(ui): display device energy in kWh"
git push origin main
```

After CI and CodeQL are green:

```bash
git tag -a v0.8.39 -m "SALTA v0.8.39"
git push origin v0.8.39
```
