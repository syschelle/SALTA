from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    source = p.read_text()
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement, found {count}: {old[:120]!r}")
    p.write_text(source.replace(old, new, 1))


# Correct HomeMatic XML-RPC init/unregister semantics and proactively clear stale
# callback registrations before registering the current SALTA instance.
replace_once(
    "src/openccu-xmlrpc.ts",
    '''function initRequest(callbackUrl: string, instanceId: string): string {
  return `<?xml version="1.0"?><methodCall><methodName>init</methodName><params><param>${xmlStringValue(callbackUrl)}</param><param>${xmlStringValue(instanceId)}</param></params></methodCall>`;
}
''',
    '''export function openCcuXmlRpcInitRequest(callbackUrl: string, instanceId: string): string {
  return `<?xml version="1.0"?><methodCall><methodName>init</methodName><params><param>${xmlStringValue(callbackUrl)}</param><param>${xmlStringValue(instanceId)}</param></params></methodCall>`;
}
''',
)

replace_once(
    "src/openccu-xmlrpc.ts",
    '''      try {
        await postXml(endpoint, initRequest(this.callbackUrl, this.instanceId));
        nextRegistrations.set(interfaceName, endpoint);
        this.log("info", "OPENCCU_CALLBACK_REGISTERED", "OpenCCU XML-RPC callback registered", { interfaceName, endpoint });
      } catch (error) {
        this.log("warning", "OPENCCU_CALLBACK_REGISTRATION_FAILED", "OpenCCU XML-RPC callback could not be registered", {
          interfaceName,
          endpoint,
          error: error instanceof Error ? error.message : String(error)
        });
      }
''',
    '''      try {
        // A previous SALTA container can disappear without running stop(). HomeMatic
        // unregisters event delivery by receiving the same callback URL with an
        // empty interface_id. Clear that URL first so a stale instance ID cannot
        // keep receiving events after a hard container replacement.
        await postXml(endpoint, openCcuXmlRpcInitRequest(this.callbackUrl, ""));
        this.log("info", "OPENCCU_CALLBACK_STALE_REGISTRATION_CLEARED", "Stale OpenCCU XML-RPC callback registration cleared", {
          interfaceName,
          endpoint,
          callbackUrl: this.callbackUrl
        });
      } catch (error) {
        this.log("warning", "OPENCCU_CALLBACK_STALE_REGISTRATION_CLEAR_FAILED", "Stale OpenCCU XML-RPC callback registration could not be cleared", {
          interfaceName,
          endpoint,
          callbackUrl: this.callbackUrl,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      try {
        await postXml(endpoint, openCcuXmlRpcInitRequest(this.callbackUrl, this.instanceId));
        nextRegistrations.set(interfaceName, endpoint);
        this.log("info", "OPENCCU_CALLBACK_REGISTERED", "OpenCCU XML-RPC callback registered", { interfaceName, endpoint, callbackUrl: this.callbackUrl });
      } catch (error) {
        this.log("warning", "OPENCCU_CALLBACK_REGISTRATION_FAILED", "OpenCCU XML-RPC callback could not be registered", {
          interfaceName,
          endpoint,
          callbackUrl: this.callbackUrl,
          error: error instanceof Error ? error.message : String(error)
        });
      }
''',
)

replace_once(
    "src/openccu-xmlrpc.ts",
    '''  async stop(unregister = true): Promise<void> {
    const registrations = [...this.registrations.entries()];
    this.registrations.clear();
    this.registrationSignature = "";
    if (unregister) {
      await Promise.all(registrations.map(async ([interfaceName, endpoint]) => {
        try {
          await postXml(endpoint, initRequest("", this.instanceId));
        } catch (error) {
          this.log("warning", "OPENCCU_CALLBACK_UNREGISTER_FAILED", "OpenCCU XML-RPC callback could not be unregistered cleanly", {
            interfaceName,
            endpoint,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }));
    }
''',
    '''  async stop(unregister = true): Promise<void> {
    const registrations = [...this.registrations.entries()];
    const callbackUrl = this.callbackUrl;
    this.registrations.clear();
    this.registrationSignature = "";
    if (unregister && callbackUrl) {
      await Promise.all(registrations.map(async ([interfaceName, endpoint]) => {
        try {
          await postXml(endpoint, openCcuXmlRpcInitRequest(callbackUrl, ""));
          this.log("info", "OPENCCU_CALLBACK_UNREGISTERED", "OpenCCU XML-RPC callback unregistered", {
            interfaceName,
            endpoint,
            callbackUrl
          });
        } catch (error) {
          this.log("warning", "OPENCCU_CALLBACK_UNREGISTER_FAILED", "OpenCCU XML-RPC callback could not be unregistered cleanly", {
            interfaceName,
            endpoint,
            callbackUrl,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }));
    }
''',
)

# Unit/regression coverage for exact unregister semantics plus startup ordering.
replace_once(
    "src/openccu-events.test.ts",
    'import { OPENCCU_CALLBACK_PORT, openCcuButtonEventValue, openCcuXmlRpcEvents, openCcuXmlRpcInterfacePort } from "./openccu-xmlrpc.js";\n',
    'import { OPENCCU_CALLBACK_PORT, openCcuButtonEventValue, openCcuXmlRpcEvents, openCcuXmlRpcInitRequest, openCcuXmlRpcInterfacePort } from "./openccu-xmlrpc.js";\n',
)
replace_once(
    "src/openccu-events.test.ts",
    '''  it("uses the proven BidCos-RF and SALTA callback ports", () => {
    expect(openCcuXmlRpcInterfacePort("BidCos-RF")).toBe(2001);
    expect(OPENCCU_CALLBACK_PORT).toBe(18099);
  });
''',
    '''  it("uses HomeMatic init semantics to unregister the same callback URL with an empty interface id", () => {
    const callbackUrl = "http://192.168.178.211:18099/";
    const request = openCcuXmlRpcInitRequest(callbackUrl, "");
    expect(request).toContain(`<param><value><string>${callbackUrl}</string></value></param>`);
    expect(request).toContain("<param><value><string></string></value></param>");
  });

  it("uses the proven BidCos-RF and SALTA callback ports", () => {
    expect(openCcuXmlRpcInterfacePort("BidCos-RF")).toBe(2001);
    expect(OPENCCU_CALLBACK_PORT).toBe(18099);
  });
''',
)

replace_once(
    "src/openccu-control.test.ts",
    'const adapter = readFileSync(new URL("./openccu-adapter.ts", import.meta.url), "utf8");\n',
    'const adapter = readFileSync(new URL("./openccu-adapter.ts", import.meta.url), "utf8");\nconst xmlRpc = readFileSync(new URL("./openccu-xmlrpc.ts", import.meta.url), "utf8");\n',
)
replace_once(
    "src/openccu-control.test.ts",
    '''    expect(adapter).toContain("callbackServer.invalidateRegistrations()");
    expect(core).toContain('snapshot.channelType.trim().toUpperCase() === "KEY"');
''',
    '''    expect(adapter).toContain("callbackServer.invalidateRegistrations()");
    const staleClear = 'await postXml(endpoint, openCcuXmlRpcInitRequest(this.callbackUrl, ""));';
    const freshRegister = 'await postXml(endpoint, openCcuXmlRpcInitRequest(this.callbackUrl, this.instanceId));';
    expect(xmlRpc).toContain(staleClear);
    expect(xmlRpc).toContain(freshRegister);
    expect(xmlRpc.indexOf(staleClear)).toBeLessThan(xmlRpc.indexOf(freshRegister));
    expect(xmlRpc).toContain('await postXml(endpoint, openCcuXmlRpcInitRequest(callbackUrl, ""));');
    expect(xmlRpc).not.toContain('openCcuXmlRpcInitRequest("", this.instanceId)');
    expect(core).toContain('snapshot.channelType.trim().toUpperCase() === "KEY"');
''',
)

# Enforce the corrected lifecycle in the release contract.
replace_once(
    "scripts/validate-release.mjs",
    '''if (!openCcuAdapterSource.includes('key: "buttonEvent"') || !openCcuAdapterSource.includes("callbackServer.invalidateRegistrations()")) fail("OpenCCU realtime button-event wiring or reconnect registration is missing");
''',
    '''if (!openCcuAdapterSource.includes('key: "buttonEvent"') || !openCcuAdapterSource.includes("callbackServer.invalidateRegistrations()")) fail("OpenCCU realtime button-event wiring or reconnect registration is missing");
if (!openCcuXmlRpcSource.includes('await postXml(endpoint, openCcuXmlRpcInitRequest(this.callbackUrl, ""));') || !openCcuXmlRpcSource.includes('await postXml(endpoint, openCcuXmlRpcInitRequest(this.callbackUrl, this.instanceId));') || openCcuXmlRpcSource.indexOf('await postXml(endpoint, openCcuXmlRpcInitRequest(this.callbackUrl, ""));') > openCcuXmlRpcSource.indexOf('await postXml(endpoint, openCcuXmlRpcInitRequest(this.callbackUrl, this.instanceId));')) fail("OpenCCU startup must clear the callback URL before registering the new instance id");
if (!openCcuXmlRpcSource.includes('await postXml(endpoint, openCcuXmlRpcInitRequest(callbackUrl, ""));') || openCcuXmlRpcSource.includes('openCcuXmlRpcInitRequest("", this.instanceId)')) fail("OpenCCU callback shutdown must unregister the same URL with an empty interface id");
''',
)

# Changelog and release text.
changelog = Path("CHANGELOG.md")
text = changelog.read_text()
marker = "# Changelog\n\n"
if not text.startswith(marker):
    raise SystemExit("CHANGELOG.md header changed")
entry = '''## 0.8.130 - Reliable OpenCCU callback re-registration after restart

- Clear any stale HomeMatic XML-RPC registration for the SALTA callback URL before registering the new SALTA instance ID.
- Correct callback shutdown semantics to unregister with the same callback URL and an empty `interface_id`, matching the official HomeMatic XML-RPC contract.
- Recover automatically when a previous SALTA container was replaced or killed before it could unregister its callback.
- Keep the existing real-time contact mapping, callback/poll serialization and 60-second reconciliation fallback unchanged.
- Add lifecycle regression coverage and release-validator enforcement for stale cleanup, fresh registration ordering and clean shutdown.

'''
changelog.write_text(marker + entry + text[len(marker):])

Path("RELEASE_TEXT.md").write_text('''# SALTA v0.8.130

SALTA v0.8.130 makes OpenCCU XML-RPC callback registration recover reliably after SALTA container restarts, including hard container replacements where the previous process could not unregister cleanly.

## Changes

- SALTA now proactively clears any stale OpenCCU XML-RPC registration for its callback URL before registering the current SALTA instance ID.
- Callback cleanup uses the official HomeMatic XML-RPC `init(url, interface_id)` contract: the callback URL stays unchanged and `interface_id` is empty when unregistering.
- Normal SALTA shutdown now uses the same correct unregister semantics.
- Callback lifecycle logs include the callback URL for startup cleanup, registration and clean shutdown diagnostics.
- Existing classic HomeMatic/BidCos contact `STATE=true/false` handling remains unchanged.
- The 60-second OpenCCU polling path remains available as fallback and reconciliation.

## Root Cause

Production packet capture proved that OpenCCU delivered the `HM-Sec-SCo` door contact events to the SALTA callback URL, but the updated SALTA process still showed only `openccu-poll` as the contact-state origin. A hard container replacement can leave the previous XML-RPC callback registration behind because the old process never reaches its shutdown cleanup.

SALTA also used the HomeMatic XML-RPC unregister parameters in the wrong direction: it sent an empty callback URL together with the old instance ID. The official HomeMatic XML-RPC contract requires unregistering the same callback URL with an empty `interface_id`.

v0.8.130 corrects shutdown unregister behavior and, more importantly, performs an explicit stale-registration cleanup for the callback URL before every fresh process registration. This makes the callback lifecycle recover after both clean and hard SALTA restarts.

## Compatibility

- No database schema change or migration is required.
- Existing automations require no editing.
- Existing OpenCCU device mappings and classic BidCos contact semantics remain unchanged.
- The SALTA callback port remains TCP 18099 and BidCos-RF XML-RPC remains on port 2001.
- No npm dependency is added or changed.
- No new mandatory environment variable is introduced.
- Existing PostgreSQL, SALTA runtime and HomeKit data/volumes remain compatible.

## Tests

- Regression coverage verifies that stale callback cleanup uses the same callback URL with an empty interface ID.
- Regression coverage verifies that stale cleanup occurs before registration of the current SALTA instance ID.
- Regression coverage verifies that clean shutdown also unregisters the same callback URL with an empty interface ID.
- Release-validator coverage enforces the corrected callback lifecycle contract.
- Release validator must pass for SALTA v0.8.130.
- JavaScript syntax checks, TypeScript production build and the complete test suite must pass before release.

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
''')

print("Prepared SALTA v0.8.130 callback lifecycle fix")
