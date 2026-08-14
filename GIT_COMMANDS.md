# SALTA v0.8.42 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(climate): add summer thermostat guard and stabilize CodeQL"
git push origin main
```

## Switch GitHub CodeQL to Advanced Setup

After the commit containing `.github/workflows/codeql.yml` is visible on `main`, switch the repository from GitHub-managed Default Setup to Advanced Setup in **Settings → Advanced Security → CodeQL analysis → Switch to advanced**. GitHub labels the confirmation button `Disable CodeQL`; this disables only Default Setup so the repository workflow can take over. Do not remove either language from the workflow matrix.

The Advanced Setup workflow continues to analyze both:

- `javascript-typescript`
- `actions`

and temporarily uses the official CodeQL Bundle v2.26.2.

## Verify before release

```bash
npm ci
npm run check
```

The validator output must include:

```text
Release validator contract: SALTA v0.8.42 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.42.
```

Wait for GitHub CI and CodeQL to be completely green before tagging.

## Tag after CI and CodeQL are green

```bash
git tag -a v0.8.42 -m "SALTA v0.8.42"
git push origin v0.8.42
```

## Production update

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Updating from v0.8.41 does not require the legacy HomeKit storage migration.
