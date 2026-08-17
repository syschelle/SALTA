# SALTA v0.8.88 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(security): harden XML-RPC and FRITZ digest handling"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'
git show origin/main:src/openccu-xmlrpc.ts | grep -F 'if (bare.includes("<") || bare.includes(">")) return undefined'
! git show origin/main:src/openccu-xmlrpc.ts | grep -F 'fragment.replace(/<[^>]+>/g'
! git show origin/main:src/fritzbox-presence.ts | grep -E 'createHash\(["'"'"']md5["'"'"']\)'
git show origin/main:src/fritzbox-presence.ts | grep -F 'const secret = digestHash("MD5"'
git show origin/main:src/fritzbox-presence.ts | grep -F 'return digestHash("MD5"'
git show origin/main:src/openccu-events.test.ts | grep -F 'rejects unknown typed XML-RPC value markup'
git show origin/main:src/fritzbox-presence.test.ts | grep -F 'shared digest helper with no direct MD5 crypto call'
git show origin/main:docker-compose.image.yml | grep -F 'ghcr.io/syschelle/salta:0.8.88'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.88 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.88.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.88 -m "SALTA v0.8.88"
git push origin v0.8.88
```

## GitHub Release

```bash
gh release create v0.8.88 \
  --title "SALTA v0.8.88" \
  --notes-file RELEASE_TEXT.md
```
