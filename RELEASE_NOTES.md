# SALTA v0.2.3

## Fixed

- Prevented GitHub Actions CI runs from being canceled during `npm ci`.
- Prevented running multi-architecture release builds from being canceled by newer workflow runs.
- Improved reliability of AMD64 and ARM64 container publishing.

## Docker

- linux/amd64
- linux/arm64

This maintenance release fixes workflow cancellation behavior. No functional SALTA application changes are included.
