# SALTA v0.4.16

SALTA v0.4.16 adds persistent light and dark themes to the web interface.

## Highlights

- Live light/dark theme switching
- Complete dark styling across the application
- Theme preference remembered for one year
- No light-theme flash during page loading
- Accessible theme control and reduced-motion support
- Browser theme color updated automatically

## Appearance Control

The SALTA sidebar now includes an appearance switch. Selecting **Dark theme** or **Light theme** updates the complete interface immediately without reloading the page.

The selected appearance applies to:

- Dashboard statistics and panels
- Device and room cards
- Navigation and mobile navigation
- Forms, filters and search fields
- Shelly onboarding and configuration dialogs
- Window-covering controls
- Status, warning and error messages

## Persistent Preference

SALTA stores the selected appearance in the functional browser cookie:

```text
salta_theme=light|dark
```

The cookie is scoped to the SALTA application path, uses `SameSite=Lax`, and expires after one year. When SALTA is served over HTTPS, the cookie also uses the `Secure` attribute.

The saved theme is applied in the document head before the stylesheet loads. This prevents the interface from briefly rendering in the light theme before switching to dark mode.

The preference remains local to the browser and is not stored in PostgreSQL or transmitted to external services.

## Accessibility

The theme switch is a native keyboard-accessible button with a descriptive label and `aria-pressed` state. SALTA also updates `color-scheme` so supported browser controls match the active theme. Theme transitions are disabled when `prefers-reduced-motion` is enabled.

## Updating

No manual database migration is required.

To pin this release:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.16
```

Then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Quality Assurance

The following checks completed successfully:

- TypeScript strict type check
- Automated tests
- Production build
- Frontend JavaScript syntax validation
- Shell script syntax validation

## Container Tags

```text
0.4.16
0.4
latest
```

## Git Tag

```text
v0.4.16
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
