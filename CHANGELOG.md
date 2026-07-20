# Changelog

## 0.3.0-alpha.1

### Added
- First-class room model and REST API.
- Room management and room filtering in the web UI.
- Global Shelly credentials.
- Per-device credential inheritance, override and no-auth modes.
- AES-256-GCM secret encryption using `SALTA_ENCRYPTION_KEY`.

### Changed
- Devices use room identifiers while retaining a readable room name in API responses.
- Existing textual room values are migrated automatically.
- Dashboard values use readable labels and units.

### Security
- Credential APIs return only `passwordConfigured`, never stored passwords.

## 0.2.5

- Fixed inaccessible npm registry URLs in the lockfile.
