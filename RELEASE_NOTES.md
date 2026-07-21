# SALTA v0.4.16

SALTA v0.4.16 adds persistent light and dark themes to the web interface.

## Added

- A live appearance switch in the sidebar
- A complete dark palette for dashboards, cards, dialogs, forms and navigation
- One-year persistence through the functional `salta_theme` cookie
- Early theme restoration before the stylesheet renders
- Matching browser theme colors and native form-control appearance

## Accessibility

The theme control exposes a descriptive label and pressed state to assistive technologies. Theme transitions are disabled when the browser requests reduced motion.

## Privacy

The selected appearance is stored only in the user's browser. It is not written to PostgreSQL and is not sent to external services.

## Compatibility

No database migration is required. Existing installations start in the light theme until a user selects the dark theme.

## Quality assurance

The release passes TypeScript strict checking, automated tests, frontend JavaScript syntax validation and the production build.
