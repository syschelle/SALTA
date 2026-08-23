# SALTA v0.8.97 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "fix(automations): preserve weekday literal types"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'

git show origin/main:src/server.ts \
  | grep -F 'const automationWeekdaySchema = z.union(['

git show origin/main:src/server.ts \
  | grep -F 'executionDays: z.array(automationWeekdaySchema)'

git show origin/main:src/server.ts \
  | grep -F 'function normalizeAutomationInput(data: z.infer<typeof automationSchema>): AutomationInput'

! git show origin/main:src/server.ts \
  | grep -F 'executionDays: z.array(z.number().int().min(1).max(7))'

git show origin/main:src/automation-weekday-schema.test.ts \
  | grep -F 'keeps executionDays as the literal 1..7 union required by AutomationWeekday'

git show origin/main:docker-compose.image.yml \
  | grep -F 'ghcr.io/syschelle/salta:0.8.97'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.97 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.97.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.97 -m "SALTA v0.8.97"
git push origin v0.8.97
```

## GitHub Release

```bash
gh release create v0.8.97 \
  --title "SALTA v0.8.97" \
  --notes-file RELEASE_TEXT.md
```
