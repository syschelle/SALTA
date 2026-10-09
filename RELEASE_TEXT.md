# SALTA v0.8.101

SALTA v0.8.101 makes FRITZ!Box Wi-Fi presence detection more robust by combining the existing MAC-address identity with a configured fixed IP address. This specifically improves recovery when an iPhone or iPad starts using a different private Wi-Fi MAC address while keeping the same reserved IP address.

## v0.8.101 fixed-IP presence recovery and automatic MAC refresh

- Added a **Fixed IP address** field to each FRITZ!Box presence target alongside the existing MAC address.
- Presence reconciliation continues to query the configured MAC first, preserving the existing fast path and current behavior.
- If the stored MAC is no longer active or resolves to a different IP address, SALTA uses the configured fixed IP as a recovery identity.
- SALTA first uses AVM's `X_AVM-DE_GetSpecificHostEntyByIP` Hosts action for direct IP lookup.
- If that AVM-specific action is unavailable for the FRITZ!OS version or current TR-064 permissions, SALTA falls back to enumerating the standard Hosts table with `GetHostNumberOfEntries` and `GetGenericHostEntry` and matches the configured IP locally.
- If the fixed IP resolves to a different valid MAC address, SALTA updates the stored presence MAC automatically and immediately continues presence evaluation with the recovered host entry.
- The MAC replacement uses an expected-old-MAC update guard so a stale reconciliation result cannot silently overwrite a newer stored MAC value.
- A successful automatic MAC change is logged as `FRITZBOX_PRESENCE_MAC_UPDATED` with the target, fixed IP, old MAC and new MAC for diagnostics.
- If a MAC update cannot be persisted, presence can still be evaluated from the fixed-IP lookup for that reconciliation cycle and SALTA records a warning instead of treating the device as absent solely because the stored MAC is stale.
- Existing presence targets without a configured fixed IP remain fully compatible and continue to use MAC-only detection until they are edited.

## Presence configuration UI

- Added a required **Fixed IP address** field when creating or editing a presence target.
- The Presence page now explains that SALTA combines the configured fixed IP and known Wi-Fi MAC address.
- Added a clear iPhone/iPad warning explaining that Apple private Wi-Fi addresses can change and that SALTA can automatically refresh the stored MAC when the configured fixed IP resolves to a new MAC.
- The presence target card shows both the configured fixed IP and the currently observed IP so administrators can distinguish configuration from the live FRITZ!Box result.
- Added German and English localization for the new labels, help text, dynamic status text and validation messages.

## Persistence, backup and compatibility

- Added the additive `presence_target_network` table for fixed-IP mappings.
- The new table is created with `CREATE TABLE IF NOT EXISTS`; the existing `presence_targets` table is not altered.
- No `ALTER TABLE` statement and no manual SQL migration are required.
- A fixed IP can be assigned to only one SALTA presence target, preventing ambiguous IP-based identity recovery.
- Configuration/disaster-recovery backups now include `presence_target_network`.
- Older format-v1 backups that do not contain the new table remain restorable and simply restore presence targets without fixed-IP mappings.
- Existing PostgreSQL and SALTA runtime volumes remain compatible and must be preserved during the update.
- No new mandatory environment variable, npm dependency or deployment-topology change is introduced.

## Regression coverage

- Added validation coverage for IPv4/IPv6 presence IP input and invalid addresses.
- Added coverage for direct FRITZ!Box lookup by IP.
- Added coverage for standard Hosts-table enumeration fallback when the AVM-specific IP action is unavailable.
- Added reconciliation coverage proving that an inactive stored iPhone MAC can be replaced by the new MAC found at the configured fixed IP and that presence remains active.
- Added frontend coverage for fixed-IP editing, persistence, validation messages and the iPhone/iPad private-MAC guidance.
- Added database-schema and configuration-backup coverage for the additive presence-network mapping.
- Extended the release validator so future releases cannot accidentally drop the fixed-IP persistence, recovery action, fallback path, automatic MAC update or configuration UI.

## v0.8.100 contact trigger carried forward

- Carries forward **Closed for 10 seconds** for window and door contact automation triggers.
- The timer starts only on a real open-to-closed transition and fires only if the contact remains continuously closed for the full 10 seconds.
- Reopening the contact before expiry cancels the pending trigger.
- Existing immediate **Open** and **Closed** triggers remain unchanged.
- Before execution, SALTA re-checks that the automation and trigger still exist, the automation is enabled, the device is reachable and the contact is still closed.
- Pending timers are cleared when the automation changes or is removed, the device is removed, or the automation engine stops.

## v0.8.99 native timed Shelly automation action carried forward

- Carries forward the Shelly automation action **On for seconds** with a freely configurable whole-number duration from 1 to 86400 seconds.
- Shelly Gen1 uses `/relay/<channel>?turn=on&timer=<seconds>`.
- Shelly Gen2, Gen3 and Gen4/RPC devices use `Switch.Set` with `on: true` and `toggle_after: <seconds>`.
- The one-shot timer remains native to the Shelly device and does not depend on a later SALTA switch-off command.
- The additive `automation_timed_actions` persistence and backup/restore compatibility introduced in v0.8.99 remain unchanged.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL and SALTA runtime volumes.
