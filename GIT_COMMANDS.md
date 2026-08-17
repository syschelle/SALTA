# SALTA v0.8.89 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(ui): compact sidebar language selector"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:public/styles.css | grep -F '.sidebar-footer .language-control{grid-template-columns:1fr;align-items:stretch;gap:8px}'
git show origin/main:public/styles.css | grep -F '.sidebar-footer .language-control select{justify-self:end;width:120px;max-width:100%;min-width:0}'
git show origin/main:src/frontend-i18n.test.ts | grep -F 'keeps the sidebar language selector compact so labels are not clipped'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.89'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.89 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.89.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.89 -m "SALTA v0.8.89"
git push origin v0.8.89
```

## GitHub Release

```bash
gh release create v0.8.89 \
  --title "SALTA v0.8.89" \
  --notes-file RELEASE_TEXT.md
```
