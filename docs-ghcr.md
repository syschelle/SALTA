# GHCR release

Create and push a semantic version tag:

```bash
git tag -a v0.2.2 -m "SALTA v0.2.2"
git push origin v0.2.2
```

The `Publish SALTA container` workflow publishes a single multi-architecture image:

```text
ghcr.io/<owner>/<repository>:0.2.2
ghcr.io/<owner>/<repository>:0.2
ghcr.io/<owner>/<repository>:latest
```

Supported platforms:

- `linux/amd64`
- `linux/arm64`

After the first successful publish, open the package settings on GitHub and set the package visibility to **Public** when anonymous pulls are desired.

A job that remains **Pending** has not started building and cannot create a package. Check repository or organization Actions settings, billing/minute limits, and runner availability.
