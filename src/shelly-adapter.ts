import { createHash } from "node:crypto";
import type { Device, DeviceCommand, ShellyComponentKind } from "./types.js";
import { DeviceRegistry } from "./registry.js";
import { getDeviceCredentials } from "./db.js";
import { detectGen1Shelly, detectRpcShelly } from "./shelly-parser.js";

const now = () => new Date().toISOString();
const timeoutMs = 3500;

type JsonRecord = Record<string, unknown>;
type Generation = NonNullable<Device["generation"]>;
type ProbeResult = { host: string; generation: Generation; model: string; sourceId: string; name: string; device: Device };

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function authHeader(username: string, password: string): Record<string, string> {
  if (!username && !password) return {};
  return { authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
}

async function requestJson(url: string, username = "", password = "", method = "GET", body?: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: { accept: "application/json", "content-type": "application/json", ...authHeader(username, password) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "AUTHENTICATION_FAILED" : `HTTP_${response.status}`);
    try {
      return await response.json() as unknown;
    } catch {
      throw new Error("INVALID_DEVICE_RESPONSE");
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("DETECTION_TIMEOUT");
    if (error instanceof TypeError) throw new Error("DEVICE_UNREACHABLE");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function idFor(host: string, sourceId: string): string {
  return `shelly:${createHash("sha1").update(`${host}:${sourceId}`).digest("hex").slice(0, 20)}`;
}

function rpcGeneration(info: JsonRecord): Generation {
  const generation = Number(info.gen);
  if (generation === 2 || generation === 3 || generation === 4) return `gen${generation}`;
  return "rpc";
}

function rpcNamespace(kind: ShellyComponentKind | undefined): string {
  switch (kind) {
    case "cover": return "Cover";
    case "light": return "Light";
    case "rgb": return "RGB";
    case "rgbw": return "RGBW";
    case "cct": return "CCT";
    default: return "Switch";
  }
}

function statesEqual(a: Device["state"], b: Device["state"]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class ShellyAdapter {
  private timer?: NodeJS.Timeout;
  private reconcileTask?: Promise<void>;
  private readonly removedDeviceIds = new Set<string>();

  constructor(private registry: DeviceRegistry) {}

  start(): void {
    void this.reconcile();
    this.timer = setInterval(() => void this.reconcile(), 10_000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async probe(host: string, username = "", password = ""): Promise<ProbeResult> {
    const clean = host.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    try {
      const rawInfo = await requestJson(`http://${clean}/rpc/Shelly.GetDeviceInfo`, username, password);
      const rawStatus = await requestJson(`http://${clean}/rpc/Shelly.GetStatus`, username, password, "POST");
      const info = record(rawInfo);
      const detection = detectRpcShelly(info, rawStatus);
      const sourceId = stringValue(info.id) ?? clean;
      const model = stringValue(info.app) ?? stringValue(info.model) ?? "Shelly RPC";
      const name = stringValue(info.name) ?? model ?? sourceId;
      const timestamp = now();
      const device: Device = {
        id: idFor(clean, sourceId),
        source: "shelly",
        sourceId,
        type: detection.type,
        name,
        host: clean,
        generation: rpcGeneration(info),
        model,
        firmwareVersion: stringValue(info.ver) ?? stringValue(info.fw_id),
        hostname: sourceId,
        macAddress: stringValue(info.mac),
        componentKind: detection.componentKind,
        componentId: detection.componentId,
        channelCount: detection.channelCount,
        powerMetering: detection.powerMetering,
        coverSupport: detection.coverSupport,
        switchSupport: detection.switchSupport,
        lightSupport: detection.lightSupport,
        inputSupport: detection.inputSupport,
        reachable: true,
        state: detection.state,
        capabilities: detection.capabilities,
        homekitEnabled: true,
        credentialMode: "inherit",
        passwordConfigured: false,
        lastSeen: timestamp,
        lastEvent: timestamp
      };
      return { host: clean, generation: device.generation ?? "rpc", model, sourceId, name, device };
    } catch (rpcError) {
      if (rpcError instanceof Error && rpcError.message === "AUTHENTICATION_FAILED") throw rpcError;
      try {
        const [rawSettings, rawStatus] = await Promise.all([
          requestJson(`http://${clean}/settings`, username, password),
          requestJson(`http://${clean}/status`, username, password)
        ]);
        const settings = record(rawSettings);
        const deviceSettings = record(settings.device);
        const detection = detectGen1Shelly(settings, rawStatus);
        const sourceId = stringValue(deviceSettings.mac) ?? stringValue(deviceSettings.hostname) ?? clean;
        const model = stringValue(deviceSettings.type) ?? "Shelly Gen1";
        const name = stringValue(settings.name) ?? stringValue(deviceSettings.hostname) ?? sourceId;
        const timestamp = now();
        const device: Device = {
          id: idFor(clean, sourceId),
          source: "shelly",
          sourceId,
          type: detection.type,
          name,
          host: clean,
          generation: "gen1",
          model,
          firmwareVersion: stringValue(settings.fw),
          hostname: stringValue(deviceSettings.hostname),
          macAddress: stringValue(deviceSettings.mac),
          componentKind: detection.componentKind,
          componentId: detection.componentId,
          channelCount: detection.channelCount,
          powerMetering: detection.powerMetering,
          coverSupport: detection.coverSupport,
          switchSupport: detection.switchSupport,
          lightSupport: detection.lightSupport,
          inputSupport: detection.inputSupport,
          reachable: true,
          state: detection.state,
          capabilities: detection.capabilities,
          homekitEnabled: true,
          credentialMode: "inherit",
          passwordConfigured: false,
          lastSeen: timestamp,
          lastEvent: timestamp
        };
        return { host: clean, generation: "gen1", model, sourceId, name, device };
      } catch (gen1Error) {
        if (gen1Error instanceof Error) throw gen1Error;
        throw rpcError;
      }
    }
  }

  async add(host: string, username = "", password = "", name?: string, roomId?: string, room?: string, credentialMode: "inherit" | "custom" | "none" = "inherit"): Promise<Device> {
    const result = await this.probe(host, username, password);
    this.removedDeviceIds.delete(result.device.id);
    this.registry.restore(result.device.id);
    const device: Device = {
      ...result.device,
      name: name?.trim() || result.device.name,
      roomId,
      room,
      credentialMode,
      credentialUsername: credentialMode === "custom" ? username : undefined,
      passwordConfigured: credentialMode === "custom" && Boolean(password)
    };
    await this.registry.set(device);
    if (credentialMode === "custom") await this.registry.patchCredentials(device.id, "custom", username, password);
    return device;
  }

  async discover(prefix: string, username = "", password = ""): Promise<Omit<ProbeResult, "device">[]> {
    const match = prefix.trim().match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.(?:0\/24|\d{1,3})$/);
    if (!match) throw new Error("INVALID_SUBNET");
    const hosts = Array.from({ length: 254 }, (_, index) => `${match[1]}.${index + 1}`);
    const found: ProbeResult[] = [];
    let index = 0;
    const workers = Array.from({ length: 24 }, async () => {
      while (index < hosts.length) {
        const host = hosts[index++];
        if (!host) continue;
        try { found.push(await this.probe(host, username, password)); } catch { /* Ignore non-Shelly hosts. */ }
      }
    });
    await Promise.all(workers);
    return found.map(({ device: _device, ...item }) => item);
  }

  async refresh(device: Device): Promise<Device> {
    if (this.removedDeviceIds.has(device.id) || !device.host) return device;
    const credentials = await getDeviceCredentials(device.id);
    try {
      const probed = await this.probe(device.host, credentials.username, credentials.password);
      const seenAt = now();
      const next: Device = {
        ...device,
        ...probed.device,
        id: device.id,
        name: device.name,
        roomId: device.roomId,
        room: device.room,
        homekitEnabled: device.homekitEnabled,
        credentialMode: device.credentialMode,
        credentialUsername: device.credentialUsername,
        passwordConfigured: device.passwordConfigured,
        lastSeen: seenAt,
        lastEvent: statesEqual(device.state, probed.device.state) ? device.lastEvent : seenAt
      };
      if (this.removedDeviceIds.has(device.id)) return device;
      await this.registry.set(next);
      return next;
    } catch {
      if (this.removedDeviceIds.has(device.id)) return device;
      const next = { ...device, reachable: false, lastSeen: now() };
      await this.registry.set(next);
      return next;
    }
  }

  async remove(deviceId: string): Promise<void> {
    const device = this.registry.get(deviceId);
    if (!device) throw new Error("DEVICE_NOT_FOUND");
    if (device.source !== "shelly") throw new Error("ADAPTER_NOT_SUPPORTED");
    this.removedDeviceIds.add(deviceId);
    try {
      const removed = await this.registry.remove(deviceId);
      if (!removed) throw new Error("DEVICE_NOT_FOUND");
    } catch (error) {
      this.removedDeviceIds.delete(deviceId);
      throw error;
    }
  }

  reconcile(): Promise<void> {
    if (this.reconcileTask) return this.reconcileTask;
    this.reconcileTask = Promise.allSettled(
      this.registry.all().filter(device => device.source === "shelly").map(device => this.refresh(device))
    ).then(() => undefined).finally(() => {
      this.reconcileTask = undefined;
    });
    return this.reconcileTask;
  }

  async command(command: DeviceCommand): Promise<Device> {
    const device = this.registry.get(command.deviceId);
    if (!device || device.source !== "shelly" || !device.host) throw new Error("DEVICE_NOT_FOUND");
    if (!device.capabilities.includes(command.capability)) throw new Error("CAPABILITY_NOT_SUPPORTED");

    const credentials = await getDeviceCredentials(device.id);
    const host = `http://${device.host}`;
    const componentId = device.componentId ?? 0;

    if (device.generation !== "gen1") {
      const namespace = rpcNamespace(device.componentKind);
      let method = "";
      const params: Record<string, unknown> = { id: componentId };
      if (command.capability === "toggle") {
        method = `${namespace}.Toggle`;
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
        method = "Cover.GoToPosition";
        params.pos = Number(command.value);
      } else {
        throw new Error("CAPABILITY_NOT_SUPPORTED");
      }
      await requestJson(`${host}/rpc/${method}`, credentials.username, credentials.password, "POST", params);
    } else if (device.type === "windowCovering") {
      const action = command.capability === "setTargetPosition" ? `to_pos&roller_pos=${Number(command.value)}` : command.capability;
      await requestJson(`${host}/roller/${componentId}?go=${action}`, credentials.username, credentials.password);
    } else if (device.type === "light") {
      const turn = command.capability === "turnOn" ? "on" : command.capability === "turnOff" ? "off" : command.capability === "toggle" ? "toggle" : "on";
      const gain = command.capability === "setBrightness" ? `&brightness=${Number(command.value)}` : "";
      await requestJson(`${host}/light/${componentId}?turn=${turn}${gain}`, credentials.username, credentials.password);
    } else {
      const turn = command.capability === "turnOn" ? "on" : command.capability === "turnOff" ? "off" : "toggle";
      await requestJson(`${host}/relay/${componentId}?turn=${turn}`, credentials.username, credentials.password);
    }

    return this.refresh(device);
  }
}
