# SALTA v0.8.131 Git commands

The authoritative commands are provided directly in the release chat. This file only mirrors the repository-side integration path.

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git merge --ff-only origin/work/v0.8.118-bidcos-off-recovery-diagnostics
git push origin main
```

Post-push verification:

```bash
git fetch origin
git show origin/main:package.json | grep -F '"version": "0.8.131"'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.131'
```

After GitHub CI and CodeQL on `main` are green:

```bash
git checkout main
git pull --ff-only origin main
git fetch origin --tags
git tag -a v0.8.131 -m "SALTA v0.8.131"
git push origin v0.8.131
git rev-list -n 1 v0.8.118
```

Create the GitHub release for tag `v0.8.118` and paste the release text from the chat.

Production uses `ghcr.io/syschelle/salta:0.8.131` with `docker-compose.image.yml`.
