# SALTA v0.8.43 Git commands

The first v0.8.43 tag was created from source metadata that still reported v0.8.42 and therefore failed release validation. Because v0.8.43 was not successfully released, keep the version at v0.8.43 and replace the failed tag after the corrected commit is green.

## Commit and push the corrected source

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(release): align SALTA v0.8.43 version metadata"
git push origin main
```

## Verify before replacing the tag

```bash
npm ci
npm run check
```

The validator output must include:

```text
Release validator contract: SALTA v0.8.43 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.43.
```

Wait for CI and both CodeQL analyses to be completely green on `main`.

## Remove the failed v0.8.43 tag

```bash
git tag -d v0.8.43 2>/dev/null || true
git push origin :refs/tags/v0.8.43
```

If GitHub shows a draft or failed Release object for v0.8.43, remove that failed/draft Release in the GitHub web interface before recreating the tag. Do not delete a successfully published release.

## Recreate v0.8.43 from the corrected commit

```bash
git tag -a v0.8.43 -m "SALTA v0.8.43"
git push origin v0.8.43
```

## Production update after the release image is available

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Updating from v0.8.42 does not require the legacy HomeKit storage migration.
