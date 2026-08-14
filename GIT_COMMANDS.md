# SALTA v0.8.41 Git commands

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(backup): stabilize disaster recovery restore and CI"
git push origin main
```


Before committing, verify that the obsolete standalone test config is no longer referenced and that the corrected validator is actually in the working tree:

```bash
if git grep -n "tsconfig.tests.json" -- scripts package.json .github src test-utils; then
  echo "ERROR: obsolete tsconfig.tests.json reference still exists"
  exit 1
else
  echo "OK: no obsolete tsconfig.tests.json references"
fi

node scripts/validate-release.mjs
```

The validator output must contain:

```text
Release validator contract: SALTA v0.8.41 / test-config-from-tsconfig.json
```

After pushing, verify the committed remote file instead of only the local working tree:

```bash
git fetch origin main
git show origin/main:scripts/validate-release.mjs | grep "test-config-from-tsconfig.json"
if git show origin/main:scripts/validate-release.mjs | grep -q "tsconfig.tests.json"; then
  echo "ERROR: origin/main still contains the obsolete validator"
  exit 1
fi
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
