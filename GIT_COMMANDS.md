# SALTA v0.8.41 Git commands

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(backup): add encrypted disaster recovery"
git push origin main
```

After CI and CodeQL are green:

```bash
git tag -a v0.8.41 -m "SALTA v0.8.41"
git push origin v0.8.41
```

## Production update from a pre-v0.8.41 installation

If HomeKit has already been paired, update the source and migrate the old HAP storage **before the first v0.8.41 container recreate**:

```bash
git pull --ff-only origin main
./migrate-homekit-storage.sh

docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

If HomeKit has never been enabled/paired, the migration command is a safe no-op.

When `update.sh` is available, it performs the migration automatically before recreating the container:

```bash
./update.sh
```
