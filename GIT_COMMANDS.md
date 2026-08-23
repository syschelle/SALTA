# SALTA v0.8.98 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "test(automations): update weekday DOM sandbox mocks"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'

git show origin/main:src/frontend-automations.test.ts \
  | grep -F 'document: { getElementById: () => null, querySelectorAll: () => [] }'

git show origin/main:src/frontend-automations.test.ts \
  | grep -F 'document: { getElementById: (id: string) => elements[id] ?? null, querySelectorAll: () => [] }'

git show origin/main:docker-compose.image.yml \
  | grep -F 'ghcr.io/syschelle/salta:0.8.98'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.98 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.98.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.98 -m "SALTA v0.8.98"
git push origin v0.8.98
```

## GitHub Release

```bash
gh release create v0.8.98 \
  --title "SALTA v0.8.98" \
  --notes-file RELEASE_TEXT.md
```
