# SALTA v0.8.62 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "test(frontend): align Hue regression expectations"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:docker-compose.image.yml | sha256sum
git show origin/main:migrate-homekit-storage.sh | sha256sum

git show origin/main:src/main.ts | grep -F 'new HueAdapter(registry)'
git show origin/main:src/server.ts | grep -F '/api/settings/hue/pair'
git show origin/main:src/hue-adapter.ts | grep -F '/eventstream/clip/v2'
git show origin/main:src/hue-mdns.ts | grep -F '_hue._tcp.local'
git show origin/main:src/hue-tls.ts | grep -F 'rejectUnauthorized: true'
git show origin/main:src/hue-tls.ts | grep -F 'HUE_LOCAL_NETWORK_REQUIRED'
git show origin/main:public/index.html | grep -F 'Philips Hue'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.62 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.62.
```

Wait for GitHub CI and both CodeQL analyses to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.62 -m "SALTA v0.8.62"
git push origin v0.8.62
```

## GitHub Release with gh CLI

```bash
gh release create v0.8.62 \
  --title "SALTA v0.8.62" \
  --notes-file RELEASE_TEXT.md
```
