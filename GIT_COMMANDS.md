# SALTA v0.8.36 Git commands

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(ci): make deployment helper scripts optional"
git push origin main
```

After CI and CodeQL are green:

```bash
git tag -a v0.8.36 -m "SALTA v0.8.36"
git push origin v0.8.36
```

Production update:

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```
