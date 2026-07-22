# SALTA v0.5.7

SALTA v0.5.7 makes the main README reusable across future releases and adds practical hardware guidance for a dedicated SALTA host.

## Documentation improvements

- Added a dedicated hardware section for systems that run only SALTA
- Recommended a Raspberry Pi 4 with 4 GB RAM, a 64 GB or 128 GB USB SSD, Gigabit Ethernet and a 64-bit Linux installation
- Documented a practical minimum of two 64-bit CPU cores, 2 GB RAM and 32 GB SSD storage
- Clarified that a Raspberry Pi 5 or Intel N100/N150 system is optional rather than required for SALTA-only operation
- Recommended SSD storage instead of a microSD card for continuous PostgreSQL operation
- Renamed the version-specific clean-reinstall section to the reusable “Reset or reinstall” section
- Renamed the version-specific update section to “Updating”
- Removed obsolete references to migration from older release lines
- Removed hard-coded release numbers from installation, backup, restore, security and credential-format guidance in the README
- Clarified that the image configured in `.env` should use a fixed tag for predictable deployments

## Runtime behavior

- No application behavior changed
- No API behavior changed
- No database schema changed
- No Compose or `.env` migration is required
- No reinstall is required

## Updating

```bash
./update.sh
```

For a new installation:

```bash
./install.sh
```

## Container tags

```text
0.5.7
0.5
latest
```

## Git tag

```text
v0.5.7
```
