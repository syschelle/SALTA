# GHCR release

Create and push the semantic version tag:

```bash
git tag -a v0.5.6 -m "SALTA v0.5.6"
git push origin v0.5.6
```

The workflow publishes:

```text
ghcr.io/syschelle/salta:0.5.6
ghcr.io/syschelle/salta:0.5
ghcr.io/syschelle/salta:latest
```

Supported platforms are `linux/amd64` and `linux/arm64`.

Deploy the complete prebuilt-image stack using only `docker-compose.image.yml`:

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

For a local source build:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

A GitHub Actions run uses the workflow from the commit referenced by the tag. Push workflow fixes before creating a new tag.
