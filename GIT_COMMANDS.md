# SALTA v0.8.93 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(database): bound command history retention"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'

git show origin/main:src/db.ts \
  | grep -F "DELETE FROM commands WHERE created_at < now() - interval '90 days'"

git show origin/main:src/db.ts \
  | grep -F 'ORDER BY created_at DESC, id DESC OFFSET 10000'

git show origin/main:src/db.ts \
  | grep -F 'export async function pruneCommandHistory(): Promise<void>'

git show origin/main:src/server.ts \
  | grep -F 'await pruneCommandHistory().catch(() => undefined)'

git show origin/main:src/command-retention.test.ts \
  | grep -F 'prunes command history to 90 days and at most 10000 newest rows'

git show origin/main:docker-compose.image.yml \
  | grep -F 'ghcr.io/syschelle/salta:0.8.93'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.93 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.93.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.93 -m "SALTA v0.8.93"
git push origin v0.8.93
```

## GitHub Release

```bash
gh release create v0.8.93 \
  --title "SALTA v0.8.93" \
  --notes-file RELEASE_TEXT.md
```
