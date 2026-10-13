from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    source = p.read_text()
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement, found {count}: {old[:120]!r}")
    p.write_text(source.replace(old, new, 1))


adapter = Path("src/openccu-adapter.ts")
source = adapter.read_text()
old = '''  private async applyRealtimeEvent(event: OpenCcuXmlRpcEvent): Promise<void> {
    const entry = this.catalog.find(candidate => candidate.channelAddress === event.channelAddress);
    if (!entry) return;
    const device = this.registry.all().find(candidate => candidate.source === "openccu"
      && candidate.adapterData?.interfaceName === entry.interfaceName
      && candidate.adapterData?.channelAddress === entry.channelAddress);
    if (!device) return;
    const receivedAt = now();

    const buttonEventValue = openCcuButtonEventValue(event.parameter);
    if (entry.channelType.toUpperCase() === "KEY" && device.type === "button" && buttonEventValue !== undefined && event.value === true) {'''
new = '''  private async applyRealtimeEvent(event: OpenCcuXmlRpcEvent): Promise<void> {
    // XML-RPC callbacks already identify the physical channel address. Bind the
    // event to the live registry device instead of requiring a matching entry
    // in the periodically refreshed catalogue. The registry carries the exact
    // channel type/interface metadata used when the device was discovered and
    // remains the authoritative source for automation state updates.
    const device = this.registry.all().find(candidate => candidate.source === "openccu"
      && candidate.adapterData?.channelAddress === event.channelAddress);
    if (!device) return;
    const channelType = String(device.adapterData?.channelType ?? "").trim();
    if (!channelType) return;
    const receivedAt = now();

    const buttonEventValue = openCcuButtonEventValue(event.parameter);
    if (channelType.toUpperCase() === "KEY" && device.type === "button" && buttonEventValue !== undefined && event.value === true) {'''
if source.count(old) != 1:
    raise SystemExit(f"src/openccu-adapter.ts: callback binding block count={source.count(old)}")
source = source.replace(old, new, 1)
old2 = '    const contactOpen = openCcuContactStateEventValue(entry.channelType, event.parameter, event.value);'
new2 = '    const contactOpen = openCcuContactStateEventValue(channelType, event.parameter, event.value);'
if source.count(old2) != 1:
    raise SystemExit(f"src/openccu-adapter.ts: contact mapper count={source.count(old2)}")
source = source.replace(old2, new2, 1)
adapter.write_text(source)

# Use the exact production system.multicall envelope captured from OpenCCU.
events = Path("src/openccu-events.test.ts")
source = events.read_text()
old = '''  it("parses classic HM-Sec-SCo STATE callbacks as immediate contact states", () => {
    const opened = `<?xml version="1.0"?><methodCall><methodName>event</methodName><params><param><value>${instanceId}</value></param><param><value>NEQ1157537:1</value></param><param><value>STATE</value></param><param><value><boolean>1</boolean></value></param></params></methodCall>`;
    const closed = `<?xml version="1.0"?><methodCall><methodName>event</methodName><params><param><value>${instanceId}</value></param><param><value>NEQ1157537:1</value></param><param><value>STATE</value></param><param><value><boolean>0</boolean></value></param></params></methodCall>`;'''
new = '''  it("parses classic HM-Sec-SCo STATE callbacks as immediate contact states", () => {
    const opened = `<?xml version="1.0" encoding="iso-8859-1"?><methodCall><methodName>system.multicall</methodName><params><param><value><array><data><value><struct><member><name>methodName</name><value>event</value></member><member><name>params</name><value><array><data><value>${instanceId}</value><value>NEQ1157537:1</value><value>STATE</value><value><boolean>1</boolean></value></data></array></value></member></struct></value></data></array></value></param></params></methodCall>`;
    const closed = `<?xml version="1.0" encoding="iso-8859-1"?><methodCall><methodName>system.multicall</methodName><params><param><value><array><data><value><struct><member><name>methodName</name><value>event</value></member><member><name>params</name><value><array><data><value>${instanceId}</value><value>NEQ1157537:1</value><value>STATE</value><value><boolean>0</boolean></value></data></array></value></member></struct></value></data></array></value></param></params></methodCall>`;'''
if source.count(old) != 1:
    raise SystemExit(f"src/openccu-events.test.ts: contact packet block count={source.count(old)}")
events.write_text(source.replace(old, new, 1))

# Prove runtime callback application does not depend on the adapter catalogue.
runtime = Path("src/openccu-adapter-events.test.ts")
source = runtime.read_text()
old = '''    const internal = adapter as unknown as {
      catalog: OpenCcuCatalogEntry[];
      applyRealtimeEvent(event: { channelAddress: string; parameter: string; value: string | number | boolean }): Promise<void>;
    };
    internal.catalog = [entry];

    await internal.applyRealtimeEvent({ channelAddress: "NEQ1157537:1", parameter: "STATE", value: true });'''
new = '''    const internal = adapter as unknown as {
      applyRealtimeEvent(event: { channelAddress: string; parameter: string; value: string | number | boolean }): Promise<void>;
    };

    // Deliberately leave the adapter catalogue empty. Production callbacks
    // must bind through the live registry metadata for the channel address.
    await internal.applyRealtimeEvent({ channelAddress: "NEQ1157537:1", parameter: "STATE", value: true });'''
if source.count(old) != 1:
    raise SystemExit(f"src/openccu-adapter-events.test.ts: contact runtime block count={source.count(old)}")
runtime.write_text(source.replace(old, new, 1))

control = Path("src/openccu-control.test.ts")
source = control.read_text()
old = '    expect(adapter).toContain("openCcuContactStateEventValue(entry.channelType, event.parameter, event.value)");'
new = '    expect(adapter).toContain("openCcuContactStateEventValue(channelType, event.parameter, event.value)");\n    expect(adapter).toContain("candidate.adapterData?.channelAddress === event.channelAddress");'
if source.count(old) != 1:
    raise SystemExit(f"src/openccu-control.test.ts: callback source assertion count={source.count(old)}")
control.write_text(source.replace(old, new, 1))

validator = Path("scripts/validate-release.mjs")
source = validator.read_text()
old = '''if (!openCcuCoreSource.includes("export function openCcuContactStateEventValue") || !openCcuAdapterSource.includes("openCcuContactStateEventValue(entry.channelType, event.parameter, event.value)") || !openCcuAdapterSource.includes('stateEventOrigin: "openccu-xmlrpc"') || !openCcuAdapterSource.includes('stateEventOrigin: "openccu-poll"')) fail("OpenCCU realtime contact-state handling is incomplete");'''
new = '''if (!openCcuCoreSource.includes("export function openCcuContactStateEventValue") || !openCcuAdapterSource.includes("openCcuContactStateEventValue(channelType, event.parameter, event.value)") || !openCcuAdapterSource.includes("candidate.adapterData?.channelAddress === event.channelAddress") || !openCcuAdapterSource.includes('stateEventOrigin: "openccu-xmlrpc"') || !openCcuAdapterSource.includes('stateEventOrigin: "openccu-poll"')) fail("OpenCCU realtime contact-state handling is incomplete");'''
if source.count(old) != 1:
    raise SystemExit(f"scripts/validate-release.mjs: realtime contract count={source.count(old)}")
validator.write_text(source.replace(old, new, 1))

changelog = Path("CHANGELOG.md")
source = changelog.read_text()
marker = "# Changelog\n\n"
if not source.startswith(marker):
    raise SystemExit("CHANGELOG.md header mismatch")
entry = """## 0.8.129 - Reliable OpenCCU contact callback binding

- Bind incoming OpenCCU XML-RPC events directly to the live SALTA registry device by physical channel address instead of requiring a matching periodically refreshed catalogue entry.
- Classic `HM-Sec-SCo` / `SHUTTER_CONTACT` `STATE=true/false` callbacks can therefore update `open` immediately even when catalogue refresh/recovery state is stale or incomplete.
- Keep the 60-second poll as reconciliation/fallback and retain the existing callback/poll serialization that protects against stale poll overwrites.
- Regression coverage now uses the exact `system.multicall` contact packet shape observed on the production OpenCCU connection.
- Runtime regression coverage proves that contact callback application succeeds with an empty adapter catalogue when the device is present in the SALTA registry.

"""
changelog.write_text(marker + entry + source[len(marker):])

Path("RELEASE_TEXT.md").write_text("""# SALTA v0.8.129

SALTA v0.8.129 fixes delayed classic HomeMatic contact automations by binding received OpenCCU XML-RPC events directly to the live SALTA device registry.

## Changes

- OpenCCU realtime callbacks now resolve their SALTA device directly by the physical HomeMatic channel address stored in the live registry.
- Callback application no longer requires a matching entry in the periodically refreshed OpenCCU catalogue.
- Classic `HM-Sec-SCo` / `SHUTTER_CONTACT` `STATE=true` and `STATE=false` events therefore update the existing SALTA `open` state on the realtime callback path.
- The existing 60-second JSON-RPC poll remains active as fallback and reconciliation.
- Existing callback/poll serialization remains in place so stale polling data cannot overwrite a newer callback update.
- Existing OpenCCU KEY button callbacks continue to use the same realtime path.
- The contact regression now uses the exact `system.multicall` XML envelope captured from the production OpenCCU connection.

## Root Cause

Production packet capture proved that OpenCCU successfully delivered `NEQ1157537:1 / STATE / true|false` callbacks to SALTA on TCP port 18099. SALTA still showed the contact transition origin as `openccu-poll`, and the automation executed only when the 60-second poll observed the state change.

The v0.8.128 callback handler parsed the event correctly but required a matching entry from the adapter's periodically refreshed catalogue before it would look up and update the SALTA device. That catalogue dependency is unnecessary for an already discovered device and can silently discard a valid realtime event while catalogue state is stale, incomplete or recovering. The SALTA registry already contains the exact channel address and channel type required to apply the event.

v0.8.129 removes that catalogue gate from realtime event application and binds the callback directly to the live registry metadata.

## Compatibility

- No database schema change or migration is required.
- Existing automations require no editing.
- Classic HomeMatic/BidCos contact semantics remain `STATE=false = closed` and `STATE=true = open`.
- The OpenCCU callback port remains TCP 18099 and BidCos-RF registration remains on port 2001.
- The 60-second OpenCCU poll remains enabled as fallback/reconciliation.
- Existing OpenCCU KEY button callbacks remain compatible.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.

## Tests

- XML-RPC regression coverage parses the exact production `system.multicall` envelope for `HM-Sec-SCo` `STATE=true/false` callbacks.
- Runtime adapter coverage verifies that the contact updates immediately from registry metadata even with an empty OpenCCU adapter catalogue.
- Runtime coverage continues to verify that unrelated `LOWBAT` events do not change the contact `open` state.
- Existing KEY button realtime-event regression coverage remains active.
- Release validator, JavaScript syntax checks, TypeScript production build and the complete test suite must pass before release.

## Production update

```bash
cd /opt/SALTA
git pull --ff-only origin main
docker compose --env-file .env -f docker-compose.image.yml config
docker compose --env-file .env -f docker-compose.image.yml pull
docker compose --env-file .env -f docker-compose.image.yml up -d --force-recreate --remove-orphans
docker compose --env-file .env -f docker-compose.image.yml ps
```

Do not use `docker compose down -v` during the update. Keep the existing PostgreSQL, SALTA runtime and HomeKit data/volumes.
""")
