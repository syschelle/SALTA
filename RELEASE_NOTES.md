# SALTA v0.4.7

SALTA v0.4.7 adds safe, persistent removal of Shelly devices from the web interface.

## Improvements

- Shelly devices can now be removed from their configuration dialog.
- The confirmation clearly explains that only the SALTA registration is removed; the physical Shelly device is not reset or switched.
- Removed devices disappear immediately from the dashboard and device count.
- Associated command history is removed automatically by the existing database cascade.
- HomeKit accessories belonging to removed devices are detached from the SALTA bridge.
- A concurrent status refresh cannot recreate a device while it is being deleted.
- A removed Shelly can be added again later through the normal add-device workflow.

## API

A new endpoint is available:

```http
DELETE /api/devices/:id
```

A successful deletion returns HTTP `204 No Content`. Unknown device IDs return HTTP `404` with a structured JSON error.

## Updating

No manual database migration is required.

Pushing the Git tag `v0.4.7` triggers the `Publish SALTA container` workflow and publishes multi-architecture images for `linux/amd64` and `linux/arm64` with the tags `0.4.7`, `0.4` and `latest`.
