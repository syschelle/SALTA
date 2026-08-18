# SALTA v0.8.91 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(phoscon): prevent missed button automation events"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'

git show origin/main:src/phoscon-adapter.ts   | grep -F 'processedButtonEventSignatures'

git show origin/main:src/phoscon-adapter.ts   | grep -F 'pendingButtonEventSignatures'

git show origin/main:src/phoscon-adapter.ts   | grep -F 'this.claimButtonEvent(resourceId, eventValue, discoveredButtonUpdated, receivedAt)'

git show origin/main:src/phoscon-adapter.ts   | grep -F 'buttonEventTransport: "reconcile"'

git show origin/main:src/phoscon-button-race.test.ts   | grep -F 'emits a button event when normal reconcile discovers a timestamp missed by realtime polling'

git show origin/main:src/phoscon-button-race.test.ts   | grep -F 'does not emit twice when reconcile and fallback poll observe the same event concurrently'

git show origin/main:docker-compose.image.yml   | grep -F 'ghcr.io/syschelle/salta:0.8.91'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.91 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.91.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.91 -m "SALTA v0.8.91"
git push origin v0.8.91
```

## GitHub Release

```bash
gh release create v0.8.91   --title "SALTA v0.8.91"   --notes-file RELEASE_TEXT.md
```
