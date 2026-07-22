# GHCR release

Create and push a semantic version tag:

```bash
git tag -a v0.4.32 -m "SALTA v0.4.32"
git push origin v0.4.32
```

The `Publish SALTA container` workflow publishes a single multi-architecture image:

```text
ghcr.io/<owner>/<repository>:0.4.32
ghcr.io/<owner>/<repository>:0.4
ghcr.io/<owner>/<repository>:latest
```

Supported platforms:

- `linux/amd64`
- `linux/arm64`

Docker selects the matching platform from the image manifest automatically. Architecture-specific Compose overrides are not required.

Deploy the prebuilt image with:

```bash
docker compose -f docker-compose.yml -f docker-compose.image.yml pull
docker compose -f docker-compose.yml -f docker-compose.image.yml up -d --force-recreate
```

For a local source build, use the build override instead:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

After the first successful publish, open the package settings on GitHub and set the package visibility to **Public** when anonymous pulls are desired.

A job that remains **Pending** has not started building and cannot create a package. Check repository or organization Actions settings, billing/minute limits, and runner availability.

## Important: tags contain their workflow version

A GitHub Actions run uses the workflow file from the commit referenced by the event. Re-running an old release tag therefore does not pick up workflow fixes committed later. Push the fixes first, then create a new patch tag.

## Multi-architecture build performance

The dependency and TypeScript build stages use Docker's `BUILDPLATFORM`. This keeps `npm ci` on the native GitHub runner instead of executing it through ARM64 QEMU. Only the final lightweight runtime stage is resolved for each target platform.
