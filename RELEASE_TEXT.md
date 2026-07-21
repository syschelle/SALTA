# SALTA v0.4.11

SALTA v0.4.11 fixes room editing being interrupted by the automatic live refresh.

## Highlights

- Reliable room-name and room-icon editing
- Live device polling no longer rebuilds the room list
- Active room drafts survive intentional full data refreshes
- Focus and text selection are preserved
- New frontend regression coverage

## Room Editing

SALTA refreshes device states every five seconds. Previously, this interval used the complete page-data loader, which also rebuilt the room list. Replacing the room list removed the active input element and closed the room edit form. Depending on the polling timing, this could happen immediately after clicking into the room name field.

The live refresh now updates only device state and dashboard statistics. Rooms and room filters are refreshed only when their underlying data changes.

If a full data refresh is required while a room is being edited, SALTA preserves:

- The selected room
- The unsaved room name
- The unsaved icon value
- The active input field
- The current text selection

## Updating

No manual database migration is required.

To pin this release:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.11
```

Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Quality Assurance

The following checks completed successfully:

- TypeScript strict type check
- 28 automated tests
- Production build
- Frontend JavaScript syntax validation
- Shell script syntax validation

## Container Tags

```text
0.4.11
0.4
latest
```

## Git Tag

```text
v0.4.11
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
