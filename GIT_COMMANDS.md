# SALTA v0.8.92 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "test(phoscon): align websocket test with event deduplication"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'

git show origin/main:src/phoscon-websocket.test.ts \
  | grep -F 'if (!claimedSignature || eventValue === undefined) return'

! git show origin/main:src/phoscon-websocket.test.ts \
  | grep -F 'if (!shouldEmit || eventValue === undefined) return'

git show origin/main:src/phoscon-button-race.test.ts \
  | grep -F 'emits a button event when normal reconcile discovers a timestamp missed by realtime polling'

git show origin/main:src/phoscon-adapter.ts \
  | grep -F 'this.claimButtonEvent(resourceId, eventValue, discoveredButtonUpdated, receivedAt)'

git show origin/main:docker-compose.image.yml \
  | grep -F 'ghcr.io/syschelle/salta:0.8.92'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.92 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.92.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.92 -m "SALTA v0.8.92"
git push origin v0.8.92
```

## GitHub Release

```bash
gh release create v0.8.92 \
  --title "SALTA v0.8.92" \
  --notes-file RELEASE_TEXT.md
```
