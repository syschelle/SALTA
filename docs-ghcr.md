# Publish SALTA v0.8.92 to GHCR

```bash
git checkout main
git pull --ff-only origin main

git tag -a v0.8.92 -m "SALTA v0.8.92"
git push origin v0.8.92
```

Default image tag in `docker-compose.image.yml`:

```text
ghcr.io/syschelle/salta:0.8.92
```

HomeKit migration compatibility boundary:

- The migration helper is only relevant for a **pre-v0.8.41 container**.
- **v0.8.41 and later store HomeKit pairing state** in the persistent runtime layout.
- Production helper path: `/opt/SALTA/migrate-homekit-storage.sh`.
