# SALTA v0.8.109 release manifest

This manifest is intended for post-push verification before tagging the release.

## Release focus

v0.8.109 moves automation creation/editing from the narrow overview side panel to the dedicated internal `#automation-editor` SPA page. The automation runtime/database contract remains unchanged from v0.8.108.

## Production deployment file

```text
docker-compose.image.yml  SHA-256  289ad1fc3d56692b1bf79c058307a56813b0dfe08752cf948da1f00ad48967ce
```

Required topology:

- SALTA uses `network_mode: host`.
- PostgreSQL uses Docker's normal bridge network.
- PostgreSQL is published only on `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`.
- No custom `networks:` section or `internal: true` network exists in the production Compose file.

## Automation editor frontend

```text
public/index.html          SHA-256  eca29e1d0b2666d89d356cdb4bf5aa6fe80f72d2b4936350374d4e62586dd09c
public/automation-ui.js   SHA-256  24a8b5f79eec3640cdfaa340812afcc958ea5eb9d2a538f9ad4c720d71f85060
public/app.js             SHA-256  4ab2ebeabebc65e54a028d8c0c794caa483a15bc7c404c9db7f12bb1d1b6ef73
public/styles.css         SHA-256  dded4096a262eb902c049450754da9fdf2b5cda367d6fb959a28bf9832cf4ac3
```

Expected editor contract:

- Automations overview has a **New automation** action.
- `data-page="automation-editor"` exists as a separate internal page.
- `#automationForm` exists only inside that editor page.
- Edit/create navigation uses `#automation-editor` and returns to `#automations` after cancel/save.
- The **Then** section displays the first target as Step 1 and exposes **Next action** / **Insert wait** controls.

## Legacy HomeKit migration helper

```text
migrate-homekit-storage.sh  SHA-256  c85ff3535b9d3f81b9a0eba1bcfbec18dd530ab63816c12a87b593fa8aeb1d20
```

Production host path:

```text
/opt/SALTA/migrate-homekit-storage.sh
```

This helper is only required for HomeKit pairing state created before v0.8.41.
