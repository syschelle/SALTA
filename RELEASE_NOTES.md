# SALTA v0.4.15

SALTA v0.4.15 adds direct position control for calibrated Shelly window coverings.

## Added

- A 0–100% height slider on window-covering device cards
- Live percentage feedback while adjusting the slider
- Open, Stop and Close controls in one device card
- A calibration notice when arbitrary position control is unavailable
- Position-range validation before commands are sent

## Reliability

The five-second live refresh no longer interrupts an active slider adjustment. SALTA keeps the selected draft position until the user releases the control and then sends one target-position command.

Both Gen1 roller devices and Gen2+ Cover components continue to use their native local Shelly APIs.

## Compatibility

No database migration is required. The slider appears only when the device reports a known current position. Uncalibrated covers remain controllable through Open, Stop and Close.

## Quality assurance

The release passes TypeScript strict checking, automated tests, frontend JavaScript syntax validation and the production build.
