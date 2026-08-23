# SALTA v0.8.96 Git commands

## Commit and push

```bash
git checkout main
git pull --ff-only origin main

git add -A
git status
git commit -m "feat(automations): add weekday execution schedules"
git push origin main
```

## Verify the pushed release candidate

```bash
git fetch origin

git show origin/main:package.json | grep '"version"'

git show origin/main:src/db.ts \
  | grep -F 'CREATE TABLE IF NOT EXISTS automation_schedule_preferences'

git show origin/main:src/automations.ts \
  | grep -F 'if (!this.executionDayAllows(rule)) return'

git show origin/main:src/server.ts \
  | grep -F 'executionDays: z.array(z.number().int().min(1).max(7))'

git show origin/main:public/index.html \
  | grep -F 'id="automationWeekendEnabled"'

git show origin/main:public/automation-ui.js \
  | grep -F 'executionDays:automationElements.scheduleEnabled.checked?automationSelectedExecutionDays():automationAllExecutionDays'

git show origin/main:src/automation-weekdays.test.ts \
  | grep -F 'blocks device-triggered automations on unselected days and allows the next selected weekday'

git show origin/main:docker-compose.image.yml \
  | grep -F 'ghcr.io/syschelle/salta:0.8.96'
```

Expected release-validator output:

```text
Release validator contract: SALTA v0.8.96 / test-config-from-tsconfig.json
Release validation passed for SALTA v0.8.96.
```

Wait for GitHub CI and CodeQL to be green before tagging.

## Tag

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.96 -m "SALTA v0.8.96"
git push origin v0.8.96
```

## GitHub Release

```bash
gh release create v0.8.96 \
  --title "SALTA v0.8.96" \
  --notes-file RELEASE_TEXT.md
```
