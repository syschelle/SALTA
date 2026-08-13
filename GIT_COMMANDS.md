# SALTA v0.8.34 Git commands

```bash
git checkout main
git pull --ff-only origin main

# update.sh is a required tracked production file.
git add -A
git status
git ls-files --error-unmatch update.sh

git commit -m "fix(ci): guard required deployment scripts"
git push origin main
```

After CI and CodeQL are green:

```bash
git tag -a v0.8.34 -m "SALTA v0.8.34"
git push origin v0.8.34
```
