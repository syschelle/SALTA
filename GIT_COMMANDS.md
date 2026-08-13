# SALTA v0.8.33 Git commands

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(ui): compact system controls and harden build checks"
git push origin main
```

After CI and CodeQL are green:

```bash
git tag -a v0.8.33 -m "SALTA v0.8.33"
git push origin v0.8.33
```
