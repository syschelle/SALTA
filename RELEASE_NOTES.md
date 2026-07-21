# SALTA v0.4.11

SALTA v0.4.11 fixes room-name editing in the web interface.

## Fixed

- Clicking inside a room name or icon field no longer closes the edit form.
- The five-second live device refresh no longer rebuilds the room list.
- Active room drafts remain intact during intentional full data refreshes.
- Input focus and text selection are restored when a room list refresh is necessary.

## Background

The periodic refresh previously called the complete page-data loader. That loader replaced the room list DOM every five seconds, including any active input fields. Depending on the refresh timing, the room edit mode could disappear immediately after clicking into the field.

## Compatibility

No database migration is required.

## Quality assurance

The release passes TypeScript strict checking, 28 automated tests, frontend JavaScript syntax validation and the production build.
