# SALTA v0.8.59 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(virtual): add momentary button mode"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:docker-compose.image.yml | sha256sum
git show origin/main:migrate-homekit-storage.sh | sha256sum

git show origin/main:src/virtual-adapter.ts | grep -F 'MOMENTARY_BUTTON_RESET_MS = 500'
git show origin/main:src/server.ts | grep -F 'type: z.enum(["switch", "button"]).default("switch")'
git show origin/main:public/index.html | grep -F 'Taster (Impuls)'
git show origin/main:public/index.html | grep -F 'id="deviceVirtualType"'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.59 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.59.
```

Wait for GitHub CI and both CodeQL analyses to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.59 -m "SALTA v0.8.59"
git push origin v0.8.59
```

## GitHub Release with gh CLI

```bash
gh release create v0.8.59 \
  --title "SALTA v0.8.59" \
  --notes-file RELEASE_TEXT.md
```
