from pathlib import Path


def replace_exact(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f"{path}: expected {count} occurrence(s), found {actual}: {old[:120]!r}")
    p.write_text(text.replace(old, new))


replace_exact(
    "src/shelly-adapter.ts",
    'import { getDeviceCredentials } from "./db.js";',
    'import { getDeviceCredentials, writeSystemLog } from "./db.js";'
)
replace_exact(
    "src/shelly-adapter.ts",
    'async function requestJson(url: string, username = "", password = "", method = "GET", body?: unknown): Promise<unknown> {\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), timeoutMs);',
    'async function requestJson(url: string, username = "", password = "", method = "GET", body?: unknown, requestTimeoutMs = timeoutMs): Promise<unknown> {\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);'
)
marker = 'export class ShellyAdapter {'
helper = '''function optimisticHomeKitSwitchResult(device: Device, command: DeviceCommand, confirmed: boolean): Device {
  const timestamp = now();
  const switchedOn = command.capability === "turnOn";
  return {
    ...device,
    reachable: true,
    state: { ...device.state, on: switchedOn },
    ...(confirmed ? { lastSeen: timestamp, lastEvent: timestamp } : {})
  };
}

'''
replace_exact("src/shelly-adapter.ts", marker, helper + marker)

old_block = '''    const credentials = await getDeviceCredentials(device.id);
    const host = `http://${device.host}`;
    const componentId = device.componentId ?? 0;

    if (device.generation !== "gen1") {
      const namespace = rpcNamespace(device.componentKind);
      let method = "";
      const params: Record<string, unknown> = { id: componentId };
      if (command.capability === "toggle") {
        method = `${namespace}.Toggle`;
      } else if (timedTurnOn) {
        method = "Switch.Set";
        params.on = true;
        params.toggle_after = timedSeconds;
      } else if (command.capability === "turnOn" || command.capability === "turnOff") {
        method = `${namespace}.Set`;
        params.on = command.capability === "turnOn";
      } else if (command.capability === "setBrightness") {
        method = `${namespace}.Set`;
        params.on = true;
        params.brightness = Number(command.value);
      } else if (["open", "close", "stop"].includes(command.capability)) {
        method = `Cover.${command.capability.charAt(0).toUpperCase()}${command.capability.slice(1)}`;
      } else if (command.capability === "setTargetPosition") {
        const position = Number(command.value);
        if (!Number.isFinite(position) || position < 0 || position > 100) throw new Error("INVALID_POSITION");
        method = "Cover.GoToPosition";
        params.pos = Math.round(position);
      } else {
        throw new Error("CAPABILITY_NOT_SUPPORTED");
      }
      await requestJson(`${host}/rpc/${method}`, credentials.username, credentials.password, "POST", params);
    } else if (device.type === "windowCovering") {
      let action = command.capability;
      if (command.capability === "setTargetPosition") {
        const position = Number(command.value);
        if (!Number.isFinite(position) || position < 0 || position > 100) throw new Error("INVALID_POSITION");
        action = `to_pos&roller_pos=${Math.round(position)}`;
      }
      await requestJson(`${host}/roller/${componentId}?go=${action}`, credentials.username, credentials.password);
    } else if (device.type === "light") {
      const turn = command.capability === "turnOn" ? "on" : command.capability === "turnOff" ? "off" : command.capability === "toggle" ? "toggle" : "on";
      const gain = command.capability === "setBrightness" ? `&brightness=${Number(command.value)}` : "";
      await requestJson(`${host}/light/${componentId}?turn=${turn}${gain}`, credentials.username, credentials.password);
    } else {
      const turn = timedTurnOn ? "on" : command.capability === "turnOn" ? "on" : command.capability === "turnOff" ? "off" : "toggle";
      const timer = timedTurnOn ? `&timer=${timedSeconds}` : "";
      await requestJson(`${host}/relay/${componentId}?turn=${turn}${timer}`, credentials.username, credentials.password);
    }

    return this.refresh(device);'''

new_block = '''    const credentials = await getDeviceCredentials(device.id);
    const host = `http://${device.host}`;
    const componentId = device.componentId ?? 0;
    const homeKitSwitchWrite = command.source === "homekit"
      && device.componentKind === "switch"
      && (command.capability === "turnOn" || command.capability === "turnOff");
    const commandResponseTimeoutMs = homeKitSwitchWrite ? 2_000 : timeoutMs;

    try {
      if (device.generation !== "gen1") {
        const namespace = rpcNamespace(device.componentKind);
        let method = "";
        const params: Record<string, unknown> = { id: componentId };
        if (command.capability === "toggle") {
          method = `${namespace}.Toggle`;
        } else if (timedTurnOn) {
          method = "Switch.Set";
          params.on = true;
          params.toggle_after = timedSeconds;
        } else if (command.capability === "turnOn" || command.capability === "turnOff") {
          method = `${namespace}.Set`;
          params.on = command.capability === "turnOn";
        } else if (command.capability === "setBrightness") {
          method = `${namespace}.Set`;
          params.on = true;
          params.brightness = Number(command.value);
        } else if (["open", "close", "stop"].includes(command.capability)) {
          method = `Cover.${command.capability.charAt(0).toUpperCase()}${command.capability.slice(1)}`;
        } else if (command.capability === "setTargetPosition") {
          const position = Number(command.value);
          if (!Number.isFinite(position) || position < 0 || position > 100) throw new Error("INVALID_POSITION");
          method = "Cover.GoToPosition";
          params.pos = Math.round(position);
        } else {
          throw new Error("CAPABILITY_NOT_SUPPORTED");
        }
        await requestJson(`${host}/rpc/${method}`, credentials.username, credentials.password, "POST", params, commandResponseTimeoutMs);
      } else if (device.type === "windowCovering") {
        let action = command.capability;
        if (command.capability === "setTargetPosition") {
          const position = Number(command.value);
          if (!Number.isFinite(position) || position < 0 || position > 100) throw new Error("INVALID_POSITION");
          action = `to_pos&roller_pos=${Math.round(position)}`;
        }
        await requestJson(`${host}/roller/${componentId}?go=${action}`, credentials.username, credentials.password, "GET", undefined, commandResponseTimeoutMs);
      } else if (device.type === "light") {
        const turn = command.capability === "turnOn" ? "on" : command.capability === "turnOff" ? "off" : command.capability === "toggle" ? "toggle" : "on";
        const gain = command.capability === "setBrightness" ? `&brightness=${Number(command.value)}` : "";
        await requestJson(`${host}/light/${componentId}?turn=${turn}${gain}`, credentials.username, credentials.password, "GET", undefined, commandResponseTimeoutMs);
      } else {
        const turn = timedTurnOn ? "on" : command.capability === "turnOn" ? "on" : command.capability === "turnOff" ? "off" : "toggle";
        const timer = timedTurnOn ? `&timer=${timedSeconds}` : "";
        await requestJson(`${host}/relay/${componentId}?turn=${turn}${timer}`, credentials.username, credentials.password, "GET", undefined, commandResponseTimeoutMs);
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : String(error);
      if (!homeKitSwitchWrite || code != "DETECTION_TIMEOUT") throw error;
      const optimistic = optimisticHomeKitSwitchResult(device, command, false);
      await this.registry.set(optimistic);
      await writeSystemLog("warning", "shelly", "SHELLY_HOMEKIT_COMMAND_RESPONSE_TIMEOUT", "Shelly command response timed out after a HomeKit switch write; state will be verified by normal reconciliation", {
        deviceId: device.id,
        deviceName: device.name,
        model: device.model,
        generation: device.generation,
        capability: command.capability,
        requestedState: command.capability === "turnOn"
      }).catch(() => undefined);
      return optimistic;
    }

    if (homeKitSwitchWrite) {
      const optimistic = optimisticHomeKitSwitchResult(device, command, true);
      await this.registry.set(optimistic);
      return optimistic;
    }

    return this.refresh(device);'''
replace_exact("src/shelly-adapter.ts", old_block, new_block)

old_homekit = '''  private command(device: Device, capability: string, value?: string | number | boolean): Promise<void> {
    return this.commander.command({ deviceId: device.id, capability, value, source: "homekit" }).then(() => undefined);
  }'''
new_homekit = '''  private async command(device: Device, capability: string, value?: string | number | boolean): Promise<void> {
    const details = {
      deviceId: device.id,
      deviceName: device.name,
      model: device.model,
      source: device.source,
      capability,
      requestedValue: value,
      currentStateOn: booleanValue(device.state.on)
    };
    await writeSystemLog("info", "homekit", "HOMEKIT_COMMAND_REQUESTED", "HomeKit requested a device command", details).catch(() => undefined);
    try {
      await this.commander.command({ deviceId: device.id, capability, value, source: "homekit" });
      await writeSystemLog("info", "homekit", "HOMEKIT_COMMAND_SUCCEEDED", "HomeKit device command completed", details).catch(() => undefined);
    } catch (error) {
      await writeSystemLog("warning", "homekit", "HOMEKIT_COMMAND_FAILED", "HomeKit device command failed", {
        ...details,
        error: error instanceof Error ? error.message : String(error)
      }).catch(() => undefined);
      throw error;
    }
  }'''
replace_exact("src/homekit.ts", old_homekit, new_homekit)

replace_exact(
    "src/shelly-adapter.test.ts",
    '  setDeviceCredentials: vi.fn(async (): Promise<void> => undefined),\n  upsertDevice: vi.fn(async (): Promise<void> => undefined)',
    '  setDeviceCredentials: vi.fn(async (): Promise<void> => undefined),\n  upsertDevice: vi.fn(async (): Promise<void> => undefined),\n  writeSystemLog: vi.fn(async (): Promise<void> => undefined)'
)

shelly_test = '''

describe("ShellyAdapter HomeKit switch writes", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function homeKitSwitch() {
    return {
      id: "shelly:homekit-test",
      source: "shelly",
      sourceId: "TESTMAC",
      type: "outlet" as const,
      name: "TV",
      host: "192.168.1.173",
      generation: "gen1" as const,
      model: "SHPLG-S",
      componentKind: "switch" as const,
      componentId: 0,
      reachable: true,
      state: { on: true, power: 100 },
      capabilities: ["turnOn", "turnOff", "toggle"],
      homekitEnabled: true,
      hidden: false,
      credentialMode: "inherit" as const,
      passwordConfigured: false,
      lastSeen: "2026-10-28T15:00:00.000Z",
      lastEvent: "2026-10-28T15:00:00.000Z"
    };
  }

  it("acknowledges a confirmed HomeKit Gen1 switch write without a synchronous full refresh", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/relay/0?turn=off")) return jsonResponse({ ison: false });
      return jsonResponse({}, 404);
    }));

    const registry = new DeviceRegistry();
    registry.hydrate(homeKitSwitch());
    const adapter = new ShellyAdapter(registry);
    const result = await adapter.command({ deviceId: "shelly:homekit-test", capability: "turnOff", source: "homekit" });

    expect(result.state.on).toBe(false);
    expect(registry.get(result.id)?.state.on).toBe(false);
    expect(calls).toEqual(["http://192.168.1.173/relay/0?turn=off"]);
  });

  it("treats a HomeKit response timeout as delivery-uncertain instead of failing the HomeKit write", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })));

    const registry = new DeviceRegistry();
    registry.hydrate(homeKitSwitch());
    const adapter = new ShellyAdapter(registry);
    const command = adapter.command({ deviceId: "shelly:homekit-test", capability: "turnOff", source: "homekit" });
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await command;

    expect(result.state.on).toBe(false);
    expect(result.lastSeen).toBe("2026-10-28T15:00:00.000Z");
    expect(dbMocks.writeSystemLog).toHaveBeenCalledWith(
      "warning",
      "shelly",
      "SHELLY_HOMEKIT_COMMAND_RESPONSE_TIMEOUT",
      expect.any(String),
      expect.objectContaining({ deviceName: "TV", capability: "turnOff", requestedState: false })
    );
  });
});
'''
p = Path("src/shelly-adapter.test.ts")
text = p.read_text()
if 'describe("ShellyAdapter HomeKit switch writes"' in text:
    raise SystemExit("HomeKit Shelly regression tests already exist")
p.write_text(text + shelly_test)

p = Path("src/homekit-presentation.test.ts")
text = p.read_text()
needle = '  it("enforces per-device publication and optional HomeKit names", () => {'
guard = '''  it("logs HomeKit command origin and outcome for device writes", () => {
    expect(source).toContain('"HOMEKIT_COMMAND_REQUESTED"');
    expect(source).toContain('"HOMEKIT_COMMAND_SUCCEEDED"');
    expect(source).toContain('"HOMEKIT_COMMAND_FAILED"');
    expect(source).toContain('source: "homekit"');
  });

'''
if text.count(needle) != 1:
    raise SystemExit("homekit-presentation insertion marker mismatch")
p.write_text(text.replace(needle, guard + needle))

changelog = Path("CHANGELOG.md")
text = changelog.read_text()
marker = "# Changelog\n\n"
entry = '''## 0.8.139 - Reliable HomeKit Shelly switch writes and diagnostics

- Log every HomeKit device command with the target device, requested capability/value and command outcome.
- Keep HomeKit switch writes responsive by avoiding the synchronous full Shelly re-probe after a confirmed on/off command.
- Bound HomeKit Shelly switch-command response waiting to two seconds, below the HomeKit slow-write warning window.
- Treat a Shelly response timeout after a HomeKit on/off write as delivery-uncertain rather than immediately failing the HomeKit characteristic write.
- Preserve the requested switch state optimistically until the existing Shelly reconciliation loop verifies the authoritative device state.
- Log delivery-uncertain Shelly HomeKit writes without credentials or secrets.
- Keep API, automation and system command behavior unchanged, including their existing synchronous readback.

'''
if text.count(marker) != 1:
    raise SystemExit("CHANGELOG marker mismatch")
changelog.write_text(text.replace(marker, marker + entry, 1))
