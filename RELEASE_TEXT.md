# SALTA v0.8.13

SALTA v0.8.13 adds local Wi-Fi presence detection through a FRITZ!Box and gives the complete integration its own **Presence** page in the main navigation.

## Dedicated Presence page

- Added **Presence** as a separate item in the desktop sidebar and mobile navigation.
- Kept FRITZ!Box connection settings, polling, absence timing, house status and monitored people together on one page.
- Added a live FRITZ!Box connection status and manual **Check now** action.
- Added an overview for each configured person with presence state, MAC address, IP address, interface, last-seen time and effective absence delay.

## FRITZ!Box TR-064 integration

- Added a native SALTA FRITZ!Box presence adapter using the local TR-064 `Hosts:1` service.
- Uses `GetSpecificHostEntry` for configured MAC addresses instead of ping or ARP scanning from the SALTA container.
- Supports the standard local TR-064 HTTP/HTTPS ports and HTTP Digest authentication when credentials are required.
- Added a connection test based on the FRITZ!Box host-count request.
- Optional FRITZ!Box passwords are encrypted in PostgreSQL using the existing `SALTA_ENCRYPTION_KEY` mechanism.
- No cloud service, GPS tracking or external presence provider is required.

## Presence devices

- Added persistent named presence targets with one known MAC address per entry.
- Accepts and normalizes common MAC-address formats.
- A detected device becomes present immediately.
- An inactive device becomes absent only after the configured delay; the global default is five minutes and can be overridden per person.
- Temporary FRITZ!Box failures mark presence devices unreachable while retaining the last known presence state, preventing a gateway outage from producing false departure events.

## House presence and automations

- Added a virtual **Hauspräsenz** device derived from all monitored people.
- Exposes `present` / `anyHome` for **Jemand zuhause**.
- Exposes `nobodyHome` for **Niemand zuhause**.
- Exposes `presentCount` as the number of currently present people.
- Individual `present`, house `anyHome` and house `nobodyHome` states are automatically available as boolean automation triggers and conditions.
- Presence can therefore be combined with Shelly, Zigbee/Phoscon Daylight, HomeMatic and virtual devices using the existing automation engine.

## Persistence and compatibility

- Added the canonical `fritzbox_presence_settings` and `presence_targets` tables; they are created automatically by SALTA's existing schema initialization.
- No `ALTER TABLE` migration or manual database command is required.
- Existing v0.8.x device and automation records remain compatible.
- No new environment variable is required.
- Presence sensors are read-only and are not exported to HomeKit.

## Security and dependencies

- No production npm dependency was added or intentionally changed in v0.8.13.
- The locked dependency tree remains unchanged apart from the SALTA root version.
- Retains `find-my-way` 9.7.0.
- Retains `@homebridge/dbus-native` 0.7.7.

## Container tags

```text
0.8.13
0.8
latest
```

## Git tag

```text
v0.8.13
```
