# SALTA v0.8.77

SALTA v0.8.77 adds human-readable person names to FRITZ!Box presence targets. The overview can now show who is currently home instead of only displaying a numeric `x of y present` count, while the existing device name and MAC-address based presence detection remain unchanged.

## v0.8.77 named presence people

- Added a separate **Person name** field to each monitored Presence entry, alongside the existing **Device name** and MAC address.
- The compact overview Presence status now displays the currently present names, for example `Martin, Lisa`, instead of only `2 of 2 present`.
- When more than three people are present, the overview keeps the compact layout by showing the first three names followed by `+N`; the full count and full list remain available in the card tooltip.
- The dedicated Presence page house summary also shows the currently present person names.
- Presence target cards now show the person name as the primary title and the device name as secondary information, making entries such as `Martin` / `Martins iPhone` easy to distinguish.
- Existing presence targets remain fully compatible. If a target has no separate person profile yet, SALTA automatically uses its existing target/device name as the display-name fallback until the entry is edited.
- Added the additive `presence_target_profiles` table rather than changing the existing `presence_targets` table. Normal startup creates it automatically; no `ALTER TABLE` or manual SQL migration is required.
- The presence adapter carries the person display name into the read-only presence device metadata and publishes aggregate `presentNames` / `memberNames` state on `presence:house` for the overview.
- Configuration and disaster-recovery backups include `presence_target_profiles`. Older signed format-v1 backups without the table remain importable and restore with the existing-name fallback.
- Existing presence automations (`present`, `anyHome`, `nobodyHome`) are unchanged.
- No new mandatory environment variable, npm dependency or deployment-topology change is required.

## v0.8.76 overview hierarchy cleanup carried forward

- Combined the five top-level metrics — Devices, Reachable, Current power, Rooms and Presence — into one compact house-status band.
- Rebalanced Daylight, Vacation mode, Heating mode and Batteries into four equal-width quick-control cards on wide screens.
- Removed explanatory copy from the quick-control cards so current state, controls and warnings receive visual priority.
- Preserved all existing Daylight, Vacation mode, Heating mode and Battery functionality.
- Added responsive desktop, tablet and mobile overview layouts.

## Compatibility

- Normal startup automatically creates the additive `presence_target_profiles` table.
- No existing table is altered and no manual database command is required.
- Existing Presence targets remain valid; before a separate person name is saved, the existing target/device name is used as the display-name fallback.
- Existing Presence automations remain compatible and unchanged.
- Existing configuration and disaster-recovery backups remain importable.
- Existing `salta_postgres_data` and `salta_runtime_data` volumes remain compatible.
- Vacation mode, Heating mode, multiple AND conditions, daily time triggers and the PostgreSQL JSONB startup fix remain unchanged.
- No new mandatory environment variable is required.
- No new npm dependency is introduced.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `down -v` during the update.
