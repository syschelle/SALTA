# SALTA

> **Smart-home Abstraction & Local Transport Architecture**

SALTA is a deliberately focused, local-first smart-home control plane for homes where reliability, long-term hardware compatibility and predictable upgrades matter more than feature churn. It combines PostgreSQL persistence, a responsive web interface, a REST API, a local automation engine and an optional HomeKit bridge. SALTA currently integrates Shelly, Phoscon/deCONZ Zigbee, Philips Hue Bridge, OpenCCU/HomeMatic, FRITZ!Box Wi-Fi presence and SALTA-native virtual devices.

> Your home. Your hardware. Your rules.

## Why SALTA exists

SALTA started as a practical response to a reliability problem in my own home. I still run a number of first-generation **Shelly 1** devices. They are old by smart-home standards, but they work extremely well, they are local, and there is no technical reason to replace hardware that continues to do its job reliably.

In 2026, my Home Assistant installation was affected by problems accessing Shelly devices, particularly first-generation devices. Around the same period, the native RaspberryMatic/OpenCCU integration path I had relied on was no longer available to me in the form that had worked for years. At the same time, Home Assistant continued to evolve rapidly, including major changes around ESPHome Builder and new AI-assisted functionality. Those developments may be useful for many users, and it is entirely possible that my own installation did not follow the direction Home Assistant now expects. But that was not the problem I needed to solve.

My requirement was simpler: **a configuration that had worked reliably for roughly three years should keep working**. Existing switches, shutters, thermostats and automations should not become a recurring maintenance project merely because the surrounding platform changes.

A smart home earns acceptance only when it is dependable. The people living with it should not need to know that an upstream integration changed, an API was refactored or a platform shifted its priorities. If a light, shutter, heating rule or presence automation that worked yesterday stops working after an update, household acceptance disappears very quickly. In my house, that is also when I get a very direct reminder from *the boss at home* that reliability matters more than new features.

SALTA is my answer to that problem. It is intentionally narrower than a general-purpose home-automation platform. The goal is not to replace Home Assistant or to compete with its breadth of features. The goal is to provide a small, understandable and testable local control layer for the hardware I actually use, with an emphasis on preserving working devices instead of forcing unnecessary replacement or migration.

That leads to a few deliberate priorities:

- **Reliability before novelty.** A working integration should remain boring and predictable.
- **Local-first operation.** Core device control and automations should not depend on a cloud service.
- **Existing hardware matters.** Older devices that still work well should remain useful.
- **Explicit integrations.** Adapter behavior should be understandable, testable and independently maintainable.
- **Controlled upgrades.** Releases should be validated, reversible and should avoid unnecessary migrations.
- **Household acceptance is a feature.** The system must work for the people living with it, not only for the person maintaining it.

SALTA therefore favors a smaller supported surface with clear behavior over trying to support every possible device or ecosystem. That trade-off is intentional.

## Version roadmap

SALTA uses pre-1.0 semantic versioning while the architecture is still evolving. The original roadmap assigned the automation engine to the v0.7.x line and the dashboard to v0.8.x. During implementation, the room-based dashboard, compact device controls, virtual devices and HomeKit integration were completed within v0.7.x. The roadmap is therefore re-baselined from v0.8.0 onward:

- **v0.7.x — device and dashboard foundation:** Shelly, Zigbee, OpenCCU/HomeMatic, room overview, compact responsive cards, virtual switches and shared HomeKit command routing.
- **v0.8.x — automation engine:** persistent event rules, conditions and actions; later v0.8.x releases can extend this with additional trigger types, multiple conditions, delays and scheduling.
- **v0.9.x — assistant and advanced orchestration:** planned higher-level assistance and rule composition.
- **v1.0.0 — first stable release:** production-ready documentation, upgrade discipline, tests, backups and stable public behavior.

The v0.8.0 milestone introduces the first persistent automation rules and is intentionally a minor-version step rather than another v0.7.x patch release.

## Global heating mode and battery notifications

SALTA provides a global Summer/Winter heating mode on the Overview. It is an internal SALTA system control and is not published to HomeKit. Summer mode sets compatible thermostats to `OFF`; the Winter target mode (manual or automatic) is configured centrally under **Settings → Heizmodus** and is shown read-only on the Overview. Saving the Winter target mode does not switch thermostats until Winter is activated or **Aktuellen Modus jetzt anwenden** is used.

SALTA also monitors devices that report a battery percentage or a `lowBattery` state. Pushover can be configured under **Settings → Benachrichtigungen**. Battery warnings are aggregated and sent no more than once every seven days. The Pushover User Key and Application API Token are stored encrypted with `SALTA_ENCRYPTION_KEY`.

## HomeKit pairing

HomeKit is managed under **Settings → HomeKit**. When the bridge is enabled and not yet paired, SALTA shows both a scannable Apple Home QR code and the numeric pairing code. QR generation is fully local and uses the HAP setup URI returned by the running SALTA bridge; no pairing data is sent to an external QR service. After pairing, both pairing values are hidden.


## Supported architectures

The GitHub release workflow publishes one multi-architecture image for:

- `linux/amd64`
- `linux/arm64`

Docker automatically pulls the correct image for the host.

## Hardware for a dedicated SALTA system

SALTA does not require a powerful server when it is the only application running on the host.

### Recommended setup

- Raspberry Pi 4 with 4 GB RAM
- 64 GB or 128 GB USB SSD
- Gigabit Ethernet
- Official or high-quality power supply
- Small cooled case
- 64-bit Raspberry Pi OS Lite or another supported 64-bit Linux distribution

A Raspberry Pi 4 with 2 GB RAM is generally sufficient for SALTA alone, but 4 GB provides more reserve for operating-system updates, Docker operations and growing PostgreSQL data.

### Practical minimum

- 64-bit ARM64 or AMD64 processor with at least two CPU cores
- 2 GB RAM
- 32 GB SSD storage
- Wired Ethernet connection
- 64-bit Linux with Docker Engine and the Docker Compose plugin

Use an SSD for the PostgreSQL data volume. A microSD card is suitable for testing, but it is not recommended as the primary storage medium for continuous operation.

A Raspberry Pi 5 or an Intel N100/N150 mini PC also works, but it is not necessary when the system runs only SALTA.

## Installation

The supported production deployment contract is the standalone `docker-compose.image.yml` file together with `.env`. Clone the repository, create `.env` from the example and set the required secrets before starting SALTA:

```bash
git clone https://github.com/syschelle/SALTA.git
cd SALTA
cp .env.example .env
# Edit .env and set POSTGRES_PASSWORD, ADMIN_PASSWORD, SALTA_ENCRYPTION_KEY and SALTA_HEALTH_TOKEN.
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

The generated/example configuration publishes SALTA to the local network by default:

```env
WEB_PORT=8099
SALTA_BIND_ADDRESS=0.0.0.0
```

Open SALTA at:

```text
http://IP-OF-THE-SALTA-HOST:8099
```

Authentication cannot be disabled.

### Optional convenience scripts

Source archives may also contain `install.sh`, `update.sh`, `backup.sh` and `restore.sh`. These are convenience helpers around the same standalone Compose deployment, but they are **not required for CI, release validation or production operation**. When present, they can be enabled with:

```bash
chmod +x install.sh update.sh backup.sh restore.sh
```

`install.sh --fresh` creates a fresh `.env` with generated secrets and removes an incompatible existing SALTA data volume. `install.sh --reset` keeps the current `.env` but resets the database.

## Updating

The supported update path uses the standalone image Compose file. **When upgrading an installation that already has HomeKit paired from a release before v0.8.41, run the one-time HomeKit migration after pulling the v0.8.41 source but before recreating the SALTA container:**

```bash
git pull --ff-only
./migrate-homekit-storage.sh
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

The migration copies legacy HAP pairing files from the still-existing SALTA container into the persistent `salta_runtime_data` volume. It is safe to run when no legacy pairing exists and will not overwrite an already populated persistent HomeKit directory. From v0.8.41 onward the pairing state lives in the named runtime volume and normal future recreates do not require this legacy migration.

If `update.sh` is present, it performs the migration automatically before the first recreate and then runs the same image update steps.

## Backup and restore

SALTA provides two complementary recovery paths.

### Portable Disaster Recovery backup

Use **Settings → Sicherung** to create one password-encrypted `SALTA-full-backup-*.salta-backup.json` file. The backup is intended for a fresh SALTA host and includes the application state required to recreate the old SALTA installation with minimal manual configuration:

- rooms, device configuration and per-device HomeKit publication metadata;
- automations, presence targets, heating mode and Pushover/battery-warning settings;
- encrypted Shelly, Phoscon, Philips Hue, OpenCCU, FRITZ!Box and Pushover credentials;
- the original SALTA administrator credentials and `SALTA_ENCRYPTION_KEY`;
- HomeKit bridge identity/PIN and HAP pairing storage;
- restorable SALTA application security and rate-limit settings.

The entire payload is encrypted with **AES-256-GCM** using a key derived from the administrator-supplied backup password with **scrypt**. The backup password is never stored by SALTA. Keep the file and password separately; without the password the backup cannot be restored.

A fresh host still needs a minimal working Docker bootstrap `.env` so PostgreSQL and the SALTA container can start. Host-specific values are intentionally not forced from the old host: `POSTGRES_PASSWORD`, `SALTA_HEALTH_TOKEN`, `WEB_PORT`, `POSTGRES_HOST_PORT` and other Docker-host settings remain part of the fresh installation. HomeKit bridge configuration and HAP pairing state are restored as application/runtime state. After the encrypted backup is imported, SALTA restarts and recovered runtime settings override the corresponding bootstrap defaults where applicable.

The import validates the encrypted envelope and database schema before changing persistent data. PostgreSQL configuration and the runtime/HomeKit files are restored together with rollback handling before the database commit. System logs, command history and current physical-device live sensor values are not imported. Physical devices are refreshed from their adapters after restart.

A replacement-host recovery is therefore intentionally short:

1. install/start the same compatible SALTA release with a temporary generated `.env`;
2. log in with the temporary administrator account;
3. open **Settings → Sicherung**, select the `.salta-backup.json` file and enter its backup password;
4. confirm the restore and wait for the automatic SALTA restart;
5. log in with the administrator credentials from the restored installation and verify any reported host-port/timezone differences.

### Raw PostgreSQL backup

When the optional helper scripts are present, a database-level backup remains available for host administration:

```bash
./backup.sh
./restore.sh backups/salta-YYYYMMDD-HHMMSS.dump
```

These helpers are not part of the mandatory CI/release contract. Keep all backup files outside the SALTA system disk whenever possible.

## Manual image deployment

`docker-compose.image.yml` contains the complete production stack: PostgreSQL, SALTA, persistent volumes, HomeKit-capable host networking, health checks, security settings and all required environment-variable wiring. No additional Compose file is required.

```bash
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
```

## Local development build

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## Development and release quality gate

Run the same complete quality gate used by GitHub Actions and the Docker build before pushing a release:

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
npm run check
```

The quality gate validates release-version consistency, npm registry URLs, security dependency overrides, the Homebridge DBus lock checksum, browser JavaScript syntax, one production TypeScript build and the complete Vitest suite. Test-symbol preflight runs once before the build; the final Vitest phase reuses that result instead of repeating it.

Use the safe version command for future releases:

```bash
npm run version:set -- <next-version>
```

This command updates only the SALTA root version and known release surfaces. It deliberately does not replace matching version strings inside transitive package-lock entries, which prevents dependency tarball and integrity metadata from being corrupted during a release bump.

## Status and logs

```bash
docker compose --env-file .env -f docker-compose.image.yml ps
docker compose --env-file .env -f docker-compose.image.yml logs -f salta
```

The internal Docker health endpoint requires the generated `SALTA_HEALTH_TOKEN` and is not publicly accessible without it.


## Security

SALTA is fail-closed. A strong administrator password, a health token and an encryption key are mandatory. Browser access uses an opaque server-side session, an `HttpOnly` and `SameSite=Strict` cookie, CSRF protection and finite session lifetimes.

SALTA does not terminate TLS. Direct HTTP access is supported for trusted local networks but is unencrypted; Internet-facing or otherwise untrusted access must use an HTTPS reverse proxy. Configure `TRUSTED_PROXIES` with only the exact proxy IP address or required CIDR so SALTA can recognize HTTPS and set the `Secure` cookie attribute and HSTS correctly.

Direct Basic-authenticated API access is accepted only from `LOCAL_NETWORKS` and only without forwarded proxy headers. Basic authentication is not encrypted by itself, so it should be used through HTTPS and with narrowly configured local networks.

For the production image stack, SALTA uses host networking so HAP/mDNS can advertise directly on the Raspberry Pi LAN. PostgreSQL stays on Docker's normal bridge network and is published only on host loopback as `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`, so the database remains unavailable from the LAN while the host-networked SALTA process can connect through `127.0.0.1:${POSTGRES_HOST_PORT:-5433}`. The SALTA container drops all Linux capabilities, enables `no-new-privileges`, limits its process count and uses a writable, size-limited `/tmp` with `noexec` and `nosuid`. Application rate limits and login blocks are held in process memory, reset on restart and do not replace firewall or reverse-proxy protection.

See `SECURITY.md` for the exact behavior, configuration guidance and limitations.

## HomeKit

HomeKit is disabled by default and can be enabled at runtime from **Settings → HomeKit** without restarting SALTA. The page uses compact, responsive sections for bridge configuration, runtime/advertisement status, pairing state, bridge identity, HAP port and supported/published device counts. Supported devices are listed centrally by SALTA room with live state information and a direct per-device publication toggle, so thermostats, OpenCCU contact sensors and other compatible devices can be enabled for Apple Home without opening every device dialog. Before the bridge is paired, SALTA shows the HomeKit pairing code and local QR code in the authenticated settings page. The pairing block is removed from the layout after pairing, the code is never written to application logs, and pairing can be reset deliberately from the same page.

The production `docker-compose.image.yml` uses host networking for SALTA so HAP-NodeJS can publish mDNS/Bonjour advertisements directly on the Raspberry Pi LAN. `HOMEKIT_PORT` remains configurable, while the bridge can optionally be bound to a specific host network interface from the HomeKit settings page. PostgreSQL remains on Docker's normal bridge network and is published only on host loopback as `127.0.0.1:${POSTGRES_HOST_PORT:-5433}:5432`; it is not exposed on a LAN-facing address.

Each compatible device still has its own HomeKit section in the device configuration dialog for optional HomeKit-specific names and room overrides. The central HomeKit device list and the per-device dialog operate on the same publication flag. SALTA uses the existing SALTA room as the desired HomeKit target room by default, keeping SALTA as the single room source of truth: room renames and device moves automatically update the stored HomeKit target metadata. An exceptional override can point to another existing SALTA room without maintaining a second room list.

Supported HomeKit presentations include compatible switches, outlets, lights, fans, window coverings and thermostats plus read-only motion, contact, temperature, humidity, light, water-leak and smoke sensors. A thermostat is published only when SALTA can both set its target temperature and change its operating mode; read-only sensors are published only when the corresponding live state is available. Battery state is attached when a device exposes battery information. Commands from HomeKit use the same SALTA command router as the web interface.

The HAP bridge itself cannot force Apple Home to place a bridged accessory into an Apple Home room. SALTA therefore stores the desired room centrally as HomeKit target metadata; the final Apple Home room assignment remains controlled by Apple Home. Unsupported or incomplete device capabilities are not published as fallback switches.

The `.env` HomeKit values remain bootstrap defaults for fresh installations and backward compatibility. Once HomeKit settings are saved in the web interface, SALTA persists the runtime bridge configuration in the existing encrypted application settings path/database state. HAP pairing files live under `/var/lib/salta/homekit` in the persistent `salta_runtime_data` volume and survive normal container recreation and updates.

SALTA-owned deprecated dependencies have been removed. The HomeKit library still carries one deprecated transitive upstream package through its persistence layer; it is documented in `DEPENDENCY_NOTES.md` and retained to avoid silently breaking HomeKit.

## Shelly support

SALTA supports Shelly Gen1 REST devices and Gen2, Gen3 and Gen4 RPC devices. Detection records model, generation, firmware, hostname, address, MAC address, channel count and supported functions.

Compatible multi-channel and 2PM devices are represented according to their active switch or cover profile. Supported on/off devices can be presented as Automatic, Light, Switch, Outlet or Fan without changing the physical command routing.

Shelly authentication is configured only for Shelly devices. Zigbee devices use the single encrypted Phoscon API key, Philips Hue devices use the bridge-issued encrypted Hue application key, while HomeMatic devices use the centrally configured OpenCCU account. These integrations do not expose per-device credential controls.

Shelly authentication supports:

- `inherit`: use the global Shelly credentials;
- `custom`: use encrypted credentials stored for one device;
- `none`: connect without authentication.

Passwords are stored as `v2` AES-256-GCM values using a per-secret random salt and a `scrypt`-derived key. Removed legacy credential formats are not accepted.

## Phoscon and Zigbee support

SALTA can connect to one local Phoscon/deCONZ instance through its REST API and the deCONZ WebSocket event stream. Configure the connection under **Settings → Phoscon** using the gateway base address and either an existing API key or the guided app-pairing workflow.

For automatic pairing, temporarily enable third-party app authentication in the Phoscon gateway settings and request the API key from SALTA within the displayed authorization window. The key is encrypted in PostgreSQL with `SALTA_ENCRYPTION_KEY` and is never returned to the browser after it has been stored.

The Zigbee page is separate from the Shelly page and imports supported resources from Phoscon:

- lights and dimmable lights;
- smart plugs and other on/off actuators;
- window coverings;
- motion, contact, temperature, humidity, light, water, smoke and button sensors;
- the deCONZ virtual `Daylight` sensor (`PHDL00`) with daylight/dark state plus sunrise and sunset times; and
- power and energy measurements exposed by deCONZ.

Multiple deCONZ sensor resources belonging to the same physical Zigbee device are combined into one SALTA card. Metering or battery resources that belong to one unambiguous actuator are merged into that actuator instead of being shown as duplicate devices. `ZHASwitch` button resources are kept as dedicated SALTA button devices so remotes such as Aqara `lumi.remote...` devices remain visible and usable as automation triggers.

SALTA can switch supported lights and plugs, set brightness and control compatible window coverings. Sensor resources are read-only. deCONZ button events are received in real time over the gateway WebSocket and are published to SALTA as discrete events; repeated identical `buttonevent` values are therefore treated as separate button presses. The adapter discovers the WebSocket port from the gateway configuration and reconnects automatically after a gateway or network interruption. Names and room assignments are managed locally in SALTA.

The deCONZ `Daylight` resource is shown as a read-only light sensor. SALTA exposes `daylight` and `dark` as boolean states, displays the calculated sunrise and sunset times and translates the deCONZ daylight status into a readable solar phase. Because `daylight` and `dark` are normal boolean device states, they can be selected directly as automation triggers or as the optional automation condition.

SALTA automation triggers use the **deCONZ REST/WebSocket `state.buttonevent` code**, not a raw Zigbee `attribute_id`/attribute value pair. For example, the deCONZ button map for the Aqara WXKG11LM 2018 model (`lumi.remote.b1acn01`) uses `1002` for short release/single click, `1004` for double press, `1001` for hold and `1003` for long release. SALTA always keeps the raw deCONZ event code visible in the automation editor so device-specific mappings remain transparent.

Zigbee devices can be marked as hidden in their SALTA device settings. Hidden devices remain visible as grey cards on the Zigbee page so they can be restored later, but they are excluded from HomeKit synchronization. The visibility choice is stored locally and survives Phoscon synchronization and gateway reconnects.

Disconnecting Phoscon removes the synchronized SALTA records but does not delete or reset devices in Phoscon.

## Philips Hue Bridge support

SALTA can connect to one local Philips Hue Bridge in parallel with Phoscon/deCONZ. Hue lights stay paired with the Hue Bridge; SALTA communicates with the bridge locally over HTTPS and the Hue API v2. Under **Settings → Philips Hue**, SALTA can search the local network for Hue Bridges via mDNS, while manual IP/hostname entry remains available. Press the physical link button on the bridge and use **Mit Bridge koppeln** so SALTA can create its own application key. The key is encrypted with `SALTA_ENCRYPTION_KEY` and is never returned to the browser after storage.

The dedicated **Philips Hue** page imports supported Hue v2 `light` resources and maps Hue smart plugs as outlets. Initial controls include:

- on, off and toggle for supported lights and plugs;
- brightness for dimmable lights;
- color temperature with a Kelvin control derived from the Hue mirek range; and
- xy color control through the local SALTA color picker.

SALTA reads Hue `zigbee_connectivity` resources for reachability and keeps model, firmware, bridge/resource and archetype metadata in the device details. Local SALTA names, room assignments, presentation choices and HomeKit publication choices survive normal Hue reconciliation.

Hue API v2 state changes are received from the local `/eventstream/clip/v2` SSE stream. SALTA coalesces incoming events into a fast device reconciliation and also keeps a 15-second periodic reconciliation as a fallback. Temporary bridge or network interruptions trigger bounded realtime reconnect attempts without requiring a SALTA restart.

Hue communication is HTTPS-only. SALTA validates the bridge certificate chain against the bundled Signify Hue Bridge CA roots, validates authenticated connections against the discovered Hue Bridge ID and does not disable TLS certificate verification. The configured bridge address must resolve to a private, loopback or link-local address and only standard HTTPS port 443 is accepted, preventing the Hue adapter from being used as a general outbound HTTP client.

Hue lights and plugs use the normal SALTA capability model, so binary actions are immediately available as automation targets. Hue devices are imported with SALTA HomeKit publication disabled by default to avoid duplicate Apple Home accessories when the Hue Bridge is already linked to Apple Home; HomeKit can still be enabled explicitly per supported Hue device.

Disconnecting Philips Hue removes the synchronized SALTA records and stored SALTA Hue credentials, but it does not remove or reset lights and accessories on the Hue Bridge.

## Virtual devices

SALTA can create native virtual devices that exist entirely inside SALTA and are persisted in PostgreSQL. Open **Virtual Devices** in the main navigation to create them.

SALTA supports persistent **virtual switches** and **momentary virtual buttons**. Both can be assigned to a SALTA room, renamed later and deleted again. A virtual switch keeps its normal on/off state. A virtual button is presented as a push button in SALTA, emits a short on pulse when pressed and automatically returns to off after 500 ms.

When HomeKit is enabled, both variants are exported as writable HomeKit switch accessories. The momentary button deliberately uses switch semantics in HomeKit so Apple Home automations and geofences can activate it; SALTA then resets it automatically. This makes a virtual button suitable as a one-shot automation trigger without adding an explicit self-reset action to the rule. Commands from the SALTA web interface and HomeKit use the same device command router, so state changes remain synchronized in both systems. Deleting a virtual device removes it from the SALTA registry and from the running HomeKit bridge.

Virtual devices do not require credentials, a physical host or an external adapter. Devices without a room assignment remain visible on the Virtual Devices page but are intentionally excluded from the room-based overview until a room is assigned.

## FRITZ!Box Wi-Fi presence

SALTA can use a local FRITZ!Box as a Wi-Fi presence source. Open **Presence** in the main navigation; the dedicated page contains the complete integration instead of splitting connection and device management across Settings.

The page stores the local TR-064 transport, optional FRITZ!Box username/password, polling interval and a default absence delay. The host occupies its own full-width field, while protocol (`HTTP` or `HTTPS`) and port (`49000` or `49443`) are selected independently below it. For HTTPS, certificate verification stays enabled by default; an explicit **Disable certificate verification** option can be used for a trusted local FRITZ!Box with a self-signed certificate. This bypass is request-scoped to the FRITZ!Box adapter and never changes SALTA's global TLS behavior. A dedicated connection card shows whether TR-064 is reachable independently of the presence-polling switch; the manual connection test records success/failure, host count, endpoint and test time in the running SALTA instance. Known phones or other Wi-Fi clients are added by name and MAC address. The password is encrypted with `SALTA_ENCRYPTION_KEY` and is never returned to the browser after storage. SALTA queries the FRITZ!Box `Hosts:1` service at `/upnp/control/hosts` and uses `GetSpecificHostEntry` for each configured MAC address instead of scanning the Docker network itself. Protected Hosts actions support AVM SOAP content-level authentication (`InitChallenge` / `ClientAuth`); standard HTTP Digest authentication is retained as a compatibility fallback.

Each monitored entry becomes a read-only virtual presence device with the boolean `present` state. A detected client becomes present immediately; an inactive client remains present until its configurable absence delay expires. Temporary FRITZ!Box request failures mark the presence device unreachable while retaining the previous presence value, preventing gateway outages from being interpreted as everybody leaving home.

SALTA also maintains a virtual **House Presence** device with `anyHome`, `nobodyHome`, `present` and `presentCount`. The boolean states are available automatically as automation triggers and conditions, so rules can react to one person arriving, one person leaving, somebody being home or nobody being home. Presence devices are intentionally read-only and are not exported to HomeKit.

The default polling interval is 30 seconds and the default absence delay is five minutes. Both are configurable on the same Presence page, and an individual person can override the global absence delay. For phones that use private/randomized Wi-Fi addresses, configure the same stable MAC address that the FRITZ!Box displays for the home network.

## Automations

SALTA v0.8.x includes a local automation engine for device events and daily wall-clock schedules. Open **Automations** in the main navigation to create rules that react to device state transitions, Zigbee button events or a fixed local time without using a cloud service.

The first automation rule format contains exactly three stages:

1. **When** — choose either **Device** or **Time** as the trigger type. Device triggers fire on boolean state transitions or on every received deCONZ/Zigbee `buttonevent`, including repeated identical event codes. A time trigger runs once per local calendar day at the selected `HH:MM` wall-clock time and does not require a trigger device.
2. **Only if** — optionally require a second device to have a selected boolean state. Conditions are evaluated from the current reachable device state at execution time.
3. **Then** — choose one or more controllable targets. Binary switches/lights, including SALTA virtual switches and writable OpenCCU/HomeMatic actors, offer **On**, **Off** and **Toggle**. Covers offer **Open** and **Close**. OpenCCU/HomeMatic thermostats offer **Off**, **Auto**, **Manual** and target-temperature actions. The global SALTA **Heating mode** is also available as a system target and offers **Summer mode** and **Winter mode**. A heating-mode action uses the same climate manager as the overview controls: Summer mode turns compatible thermostats off, while Winter mode applies the winter behavior configured under **Settings → Heating mode**. Read-only sensors remain trigger/condition-only. Up to eight targets can be controlled by one automation. Normally a trigger device cannot also be a target; the deliberate exception is a SALTA virtual switch used as a one-shot/latch trigger. A virtual `on=true` trigger may reset itself with **Off** (and an `on=false` trigger with **On**), which supports HomeKit geofence patterns where Apple Home sets the virtual switch and SALTA consumes the event. The reset is executed after the other target actions.

The selectors for trigger, condition and target are searchable. Type any part of the device name, room, source (for example Shelly, Zigbee, Philips Hue, HomeMatic, Presence, Virtual or SALTA), model or logical device type to narrow the list. The internal Heating mode system target is intentionally available only as an automation action; it is hidden from the normal device pages and is not published to HomeKit. The editor also shows how many matching targets are currently available.

The engine works across supported SALTA device sources because actions use the shared device command router. For example, a Zigbee motion sensor can switch a Shelly relay, a HomeMatic contact can toggle a Philips Hue light, or a HomeKit geofence can set a SALTA virtual switch to **On**, trigger several local actions and then have SALTA reset that virtual switch to **Off**. Rules can be enabled, disabled, edited and deleted from the web interface.

Automation rules are stored in PostgreSQL and restored after restart. Daily time schedules use the additive `automation_time_triggers` persistence table, extended device target actions and values use `automation_targets`, and SALTA system actions such as Heating mode use the additive `automation_system_actions` table; the original device-trigger and action fields remain for compatibility. References to deleted trigger, condition or target devices are removed automatically by the database. SALTA rejects automation graphs that would create a device-to-device cycle across configured targets. The safe virtual self-reset exception is not treated as a cycle because it explicitly changes the trigger away from the value that fired the rule. If one target command fails at runtime, SALTA logs that target failure and continues with the remaining actions, including the final virtual reset.

The v0.8.x engine currently supports boolean device-state transitions, deCONZ/Zigbee button events and one daily local-time trigger per rule, together with one optional boolean condition and up to eight target actions. Time schedules use the configured `TZ` value (default `Europe/Berlin`), so a rule configured for 07:30 continues to run at 07:30 across daylight-saving changes; the repeated autumn clock hour is de-duplicated per local calendar day. A time trigger is currently exclusive and cannot be OR-combined with additional device triggers in the same rule. Targets include binary On/Off/Toggle actions, OpenCCU cover/mode controls, thermostat target temperatures and the global SALTA Heating mode with Summer/Winter actions. Numeric threshold triggers, delays, multiple conditions and richer calendar schedules remain planned extensions.

## OpenCCU and HomeMatic support

SALTA can connect to one local OpenCCU instance through the CCU-compatible JSON-RPC endpoint at `/api/homematic.cgi`. Configure the connection under **Settings → OpenCCU** with the OpenCCU base address and a dedicated username and password.

The password is encrypted in PostgreSQL with `SALTA_ENCRYPTION_KEY` and is never returned to the browser after it has been stored. The OpenCCU firewall must allow the SALTA host to access the OpenCCU web and JSON-RPC service. HTTP is supported inside a trusted local network; use a trusted HTTPS certificate when the connection crosses an untrusted network.

The separate HomeMatic page imports supported channels from the available `BidCos-RF`, `BidCos-Wired`, `HmIP-RF` and `VirtualDevices` interfaces. The initial integration supports:

- switches, relays and compatible smart plugs;
- dimmable lights;
- blinds, shutters and compatible window coverings;
- contact, motion, temperature, humidity, light, water and smoke sensors; and
- power, current, voltage, frequency and energy values exposed by OpenCCU.

SALTA can switch supported actuators, set light brightness, control compatible window coverings and change the target temperature of supported thermostats. HomeMatic heating thermostats and wall thermostats expose **Off**, **Manual** and **Automatic** mode buttons whenever SALTA can display their current control mode. SALTA first uses writable mode metadata reported by OpenCCU and safely falls back to the native device-family commands when OpenCCU exposes only the read-only `CONTROL_MODE` value. Classic HomeMatic devices are controlled through `AUTO_MODE` and `MANU_MODE`; Homematic IP devices use `SET_POINT_MODE` with the standard automatic and manual values. If a thermostat has no separate off mode, SALTA selects manual mode at the minimum frost-protection temperature reported by OpenCCU. Pure sensor channels remain read-only. SALTA reads ReGa device IDs through OpenCCU `Device.listAll`, resolves the physical device name through `Device.get`, and joins it to the RPC device address; a distinct channel name is shown as secondary metadata. An unchanged SALTA name follows later OpenCCU renames automatically, while a name edited locally in SALTA remains unchanged. Room assignments are managed locally and do not modify OpenCCU. Eligible OpenCCU/HomeMatic actuators, thermostats and supported read-only sensors can be published through the HomeKit bridge when HomeKit is enabled for the individual SALTA device.

SALTA polls a connected OpenCCU instance every 60 seconds and retries every 15 seconds while the gateway is offline. Transport failures and unusable channel responses invalidate the local JSON-RPC session so SALTA creates a fresh session automatically after an OpenCCU restart. The device catalogue, physical device names and writable VALUES parameter descriptions are refreshed after reconnecting and periodically during normal operation. The parameter descriptions provide the native JSON-RPC value type and write permissions used for switches, dimmers, coverings and thermostats. SALTA reuses one JSON-RPC runtime session for polling and commands, serializes OpenCCU operations, and closes the session during reconfiguration, disconnect and controlled shutdown. If OpenCCU returns error 501, SALTA keeps the combined credentials-or-session-limit message visible and pauses scheduled login retries for one minute. It does not register XML-RPC callbacks, manage OpenCCU programs or variables, or pair HomeMatic devices. Disconnecting OpenCCU removes the synchronized SALTA records but does not delete or reset devices in OpenCCU.

### OpenCCU diagnostics

The OpenCCU settings include an in-application diagnostic run. It checks login, interface discovery, device details and the device catalogue for each supported interface and shows the exact JSON-RPC method, interface, duration and remote error message. A Tcl error from an optional device-name request is displayed as a warning and does not hide an otherwise successful connection. Blocking authentication or interface errors remain visible in the settings panel until the next successful check or an explicit user action.

## System log

SALTA includes a protected **System Log** page for technical events and adapter diagnostics. It supports source and severity filters, manual refresh and clearing the retained entries. OpenCCU connection tests, failed JSON-RPC methods, synchronization results, application startup and shutdown are recorded. Passwords, API keys and OpenCCU session identifiers are not written to this log.

Entries are kept for at most 30 days and the newest 100 records. Cleanup runs during database initialization and periodically while new entries are written. The system log is available only to an authenticated SALTA user.

## Rooms

Rooms are first-class database entities linked to devices by `room_id`. The obsolete duplicate room-name column and its synchronization logic have been removed.

The overview page groups every room-assigned Shelly, Zigbee, HomeMatic and virtual device by the configured room order. The same live controls used on the adapter pages are available on the overview, while unassigned devices remain on their dedicated adapter page until a room is selected.

## Icons

SALTA bundles Material Design Icons (MDI) by Pictogrammers locally. No icon CDN is used at runtime. The bundled icon assets are provided under the Apache License 2.0; see `public/vendor/mdi/LICENSE`.

## License

SALTA source code: Apache License 2.0. See `LICENSE`.

Bundled Material Design Icons: Apache License 2.0. See `public/vendor/mdi/LICENSE`.
