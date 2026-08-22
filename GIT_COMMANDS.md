# SALTA v0.8.95 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(deconz): suppress replayed button events after reconnect"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'

git show origin/main:src/phoscon-adapter.ts \
  | grep -F 'const hasNewRevision = Boolean(lastUpdated) && lastUpdated !== priorLastUpdated'

git show origin/main:src/phoscon-adapter.ts \
  | grep -F 'const shouldConsiderEvent = eventValue !== undefined && hasNewRevision && !this.buttonRecoveryBaselinePending'

git show origin/main:src/phoscon-adapter.ts \
  | grep -F 'this.requireButtonRecoveryBaseline("rest-sync-failed")'

git show origin/main:src/phoscon-adapter.ts \
  | grep -F 'this.requireButtonRecoveryBaseline("websocket-closed")'

git show origin/main:src/phoscon-adapter.ts \
  | grep -F '"DECONZ_RECOVERY_BASELINE"'

git show origin/main:src/phoscon-recovery.test.ts \
  | grep -F 'baselines button revisions after a REST connectivity failure without replaying an automation event'

git show origin/main:docker-compose.image.yml \
  | grep -F 'ghcr.io/syschelle/salta:0.8.95'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.95 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.95.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.95 -m "SALTA v0.8.95"
git push origin v0.8.95
```

## GitHub Release

```bash
gh release create v0.8.95 \
  --title "SALTA v0.8.95" \
  --notes-file RELEASE_TEXT.md
```
