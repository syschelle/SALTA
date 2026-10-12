# SALTA v0.8.122

SALTA v0.8.122 improves the OpenCCU Duty Cycle overview by applying the requested percentage text colors.

## Changes

- Duty Cycle values up to and including 4% are displayed in green.
- Duty Cycle values above 4% up to and including 10% are displayed in yellow.
- Duty Cycle values above 10% are displayed in red.
- The color is applied to the percentage text only; the overview card layout and label remain unchanged.
- The yellow state now has a dedicated readable color for light and dark themes instead of using SALTA's general accent color.
- OpenCCU Duty Cycle acquisition via `Interface.getDutyCycle`, maximum-value selection, API response and one-minute refresh cadence are unchanged.

## Root Cause

The Duty Cycle overview introduced in v0.8.120 still used the original 70%/90% frontend warning thresholds. As a result, normal low Duty Cycle values stayed green and the intermediate state used the generic accent color rather than a dedicated yellow percentage color.

v0.8.122 changes only the presentation thresholds and warning text color requested for the overview. It does not alter OpenCCU communication or Duty Cycle measurement.

## Compatibility

- No database schema change or migration is required.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing automations require no editing.
- Existing PostgreSQL and SALTA runtime volumes remain compatible.
- Existing HomeKit pairing state remains compatible.
- OpenCCU device discovery, thermostat control and Duty Cycle polling are unchanged.

## Tests

- Regression coverage verifies the new 4%/10% Duty Cycle frontend thresholds.
- Regression coverage verifies that the yellow warning state has dedicated light- and dark-theme text colors.
- Release-validator coverage requires the new Duty Cycle threshold expression.
- Release validator, JavaScript syntax checks, TypeScript production build and complete test suite are executed by GitHub Actions before release.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.
