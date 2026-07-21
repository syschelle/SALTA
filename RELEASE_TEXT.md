# SALTA v0.4.15

SALTA v0.4.15 adds direct percentage-based position control for calibrated Shelly window coverings.

## Highlights

- 0–100% height slider for calibrated covers
- Live percentage preview while adjusting the slider
- Open, Stop and Close controls on every cover card
- Clear calibration guidance when position control is unavailable
- Stable slider interaction during live status refreshes
- Validated target-position commands

## Window-Covering Position Control

A calibrated Shelly cover now displays a **Height** slider directly on its device card. The slider ranges from fully closed at `0%` to fully open at `100%`.

SALTA shows the selected percentage immediately while the slider is being adjusted. When the user releases the control, SALTA sends one target-position command to the correct Shelly cover component.

The existing discrete controls remain available:

- Open
- Stop
- Close

## Calibration Handling

Shelly position control requires a calibrated cover and a known current position. When the device does not report a current position, SALTA hides the slider and displays a clear notice that calibration is required.

Open, Stop and Close remain available even without percentage-based position control.

## Reliability

The regular five-second device refresh no longer replaces an actively used cover slider. This prevents the control from jumping back or losing focus while the user is selecting a position.

Target positions are validated and restricted to the supported range from `0` to `100` before they are sent to the device.

## Supported Shelly APIs

- Gen2+ devices use `Cover.GoToPosition`
- Gen1 roller devices use the local `roller/<id>?go=to_pos&roller_pos=<position>` endpoint

## Updating

No manual database migration is required.

To pin this release:

```env
SALTA_IMAGE=ghcr.io/syschelle/salta:0.4.15
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
0.4.15
0.4
latest
```

## Git Tag

```text
v0.4.15
```

## Full Changelog

All technical changes are documented in `CHANGELOG.md`.
